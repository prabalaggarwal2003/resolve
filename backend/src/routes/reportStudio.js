import express from 'express';
import { protect } from '../middleware/auth.js';
import { requireTabRead, requireTabWrite } from '../middleware/tabPermissions.js';
import {
  ReportDefinition,
  ReportSchedule,
  ReportExport,
  ReportStudioSettings,
} from '../models/index.js';
import { getReportCatalog, getQuickReportPreset, listQuickReportPresets } from '../services/reportCatalogService.js';
import {
  runReportQuery,
  rowsToCsv,
  buildExportFilename,
  getDistinctFieldValues,
} from '../services/reportQueryService.js';
import { buildReportPdfBuffer } from '../services/reportPdfExportService.js';
import {
  DEFAULT_REPORT_FORMATTING,
  DEFAULT_REPORT_STUDIO_SETTINGS,
  REPORT_EXPORT_HISTORY_LIMIT,
  REPORT_LOGO_MAX_CHARS,
} from '../constants/reportStudioDefaults.js';
import { logAudit, getRequestMetadata, AUDIT_ACTIONS, AUDIT_RESOURCES } from '../services/auditService.js';
import {
  diffReportDefinition,
  diffReportSchedule,
  diffReportSettings,
  formatReportFieldChangesSummary,
  reportAuditDetails,
  snapshotDefinitionFields,
  snapshotScheduleFields,
} from '../services/reportStudioAudit.js';

const router = express.Router();
router.use(protect);
router.use(requireTabRead('reports'));

function orgId(req) {
  return req.user.organizationId;
}

function auditReport(req, action, resourceId, resourceName, changes = [], options = {}) {
  const fieldChanges = changes;
  return logAudit(req.user._id, action, AUDIT_RESOURCES.REPORT, resourceId, {
    resourceName,
    description:
      options.description || formatReportFieldChangesSummary(resourceName, fieldChanges),
    details: reportAuditDetails(resourceName, fieldChanges, options.extra || {}),
    severity: options.severity || 'low',
    ...getRequestMetadata(req),
  });
}

function canAccessDefinition(doc, user) {
  if (!doc) return false;
  if (String(doc.organizationId) !== String(user.organizationId)) return false;
  if (doc.scope === 'system' || doc.kind === 'quick') return true;
  if (doc.scope === 'organization' || doc.published) return true;
  if (doc.ownerId && String(doc.ownerId) === String(user._id)) return true;
  if (user.role === 'super_admin' || user.role === 'admin') return true;
  return false;
}

async function getSettings(organizationId) {
  let settings = await ReportStudioSettings.findOne({ organizationId });
  if (!settings) {
    settings = await ReportStudioSettings.create({
      organizationId,
      ...DEFAULT_REPORT_STUDIO_SETTINGS,
    });
    return settings;
  }

  let dirty = false;
  if (!settings.defaultFormatting) {
    settings.defaultFormatting = { ...DEFAULT_REPORT_FORMATTING };
    dirty = true;
  }
  const branding = settings.branding?.toObject?.() || settings.branding || {};
  if (
    branding.logoUrl !== undefined ||
    branding.primaryColor !== undefined ||
    branding.logoData === undefined
  ) {
    settings.branding = {
      companyName: branding.companyName || '',
      logoData: branding.logoData || '',
    };
    dirty = true;
  }
  if (dirty) await settings.save();
  return settings;
}

/** Keep only the newest N export history rows for an organization. */
async function pruneExportHistory(organizationId, keep = REPORT_EXPORT_HISTORY_LIMIT) {
  const stale = await ReportExport.find({ organizationId })
    .sort({ createdAt: -1 })
    .skip(keep)
    .select('_id')
    .lean();
  if (!stale.length) return;
  await ReportExport.deleteMany({ _id: { $in: stale.map((d) => d._id) } });
}

function parseMaybeJson(value, fallback) {
  if (value == null) return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }
  return value;
}

function normalizeCalculations(raw) {
  const list = parseMaybeJson(raw, raw);
  if (!Array.isArray(list)) return [];
  return list
    .map((c, i) => {
      if (!c || typeof c !== 'object') return null;
      return {
        id: String(c.id || `c${i}`),
        type: String(c.type || 'count'),
        field: String(c.field || ''),
        source: c.source != null ? String(c.source) : undefined,
        label: c.label != null ? String(c.label) : undefined,
      };
    })
    .filter(Boolean);
}

function normalizeVisualization(raw) {
  const viz = parseMaybeJson(raw, raw) || {};
  if (typeof viz === 'string') {
    return { type: viz || 'table', options: {} };
  }
  return {
    type: String(viz.type || 'table'),
    options: viz.options && typeof viz.options === 'object' ? viz.options : {},
  };
}

function normalizeConfig(input = {}) {
  const src = parseMaybeJson(input, input) || {};
  return {
    primarySource: src.primarySource || src.dataSources?.[0] || 'assets',
    dataSources: Array.isArray(src.dataSources) && src.dataSources.length
      ? src.dataSources.map(String)
      : [src.primarySource || 'assets'],
    fields: Array.isArray(src.fields) ? src.fields : [],
    filters: src.filters || { logic: 'and', conditions: [] },
    groupBy: Array.isArray(src.groupBy) ? src.groupBy : [],
    sort: Array.isArray(src.sort) ? src.sort : [],
    calculations: normalizeCalculations(src.calculations),
    visualization: normalizeVisualization(src.visualization),
    formatting: src.formatting && typeof src.formatting === 'object' ? src.formatting : {},
    exportOptions: src.exportOptions && typeof src.exportOptions === 'object' ? src.exportOptions : {},
  };
}

// —— Catalog & meta ——
router.get('/catalog', async (req, res) => {
  try {
    const catalog = await getReportCatalog(orgId(req));
    res.json(catalog);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/dashboard', async (req, res) => {
  try {
    const organizationId = orgId(req);
    const userId = req.user._id;
    const [recent, favourites, schedules, failedSchedules, exports, mostUsed] = await Promise.all([
      ReportDefinition.find({
        organizationId,
        kind: { $in: ['saved', 'draft'] },
        $or: [{ ownerId: userId }, { scope: 'organization' }, { published: true }],
      })
        .sort({ lastRunAt: -1, updatedAt: -1 })
        .limit(8)
        .lean(),
      ReportDefinition.find({ organizationId, favouriteBy: userId })
        .sort({ updatedAt: -1 })
        .limit(8)
        .lean(),
      ReportSchedule.find({ organizationId, enabled: true })
        .sort({ nextRunAt: 1 })
        .limit(8)
        .populate('reportId', 'name')
        .lean(),
      ReportSchedule.find({ organizationId, lastStatus: 'failed' })
        .sort({ updatedAt: -1 })
        .limit(5)
        .populate('reportId', 'name')
        .lean(),
      ReportExport.find({ organizationId }).sort({ createdAt: -1 }).limit(10).lean(),
      ReportDefinition.find({ organizationId, kind: 'saved' })
        .sort({ runCount: -1 })
        .limit(8)
        .lean(),
    ]);

    const exportStats = await ReportExport.aggregate([
      { $match: { organizationId } },
      {
        $group: {
          _id: '$format',
          count: { $sum: 1 },
          records: { $sum: '$recordCount' },
        },
      },
    ]);

    res.json({
      recentlyGenerated: recent,
      favourites,
      scheduled: schedules,
      failedScheduled: failedSchedules,
      exportHistory: exports,
      exportStats,
      mostUsed,
      lastGenerated: exports.slice(0, 5),
      quickReportCount: listQuickReportPresets().length,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// —— Quick reports ——
router.get('/quick', async (req, res) => {
  try {
    res.json({ reports: listQuickReportPresets() });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/quick/:key', async (req, res) => {
  try {
    const preset = getQuickReportPreset(req.params.key);
    if (!preset) return res.status(404).json({ message: 'Quick report not found' });
    res.json(preset);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// —— Run / preview / export ——
router.post('/run', async (req, res) => {
  try {
    const config = normalizeConfig(req.body.config || req.body);
    const result = await runReportQuery(orgId(req), config, {
      page: req.body.page,
      limit: req.body.limit,
    });

    if (req.body.reportId) {
      await ReportDefinition.updateOne(
        { _id: req.body.reportId, organizationId: orgId(req) },
        { $set: { lastRunAt: new Date() }, $inc: { runCount: 1 } }
      );
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/export', async (req, res) => {
  try {
    const format = String(req.body.format || 'csv').toLowerCase();
    const reportName = req.body.reportName || 'Report';
    const config = normalizeConfig(req.body.config || {});
    const settings = await getSettings(orgId(req));
    const settingsFormatting =
      settings.defaultFormatting?.toObject?.() || settings.defaultFormatting || {};
    const formatting = {
      ...DEFAULT_REPORT_FORMATTING,
      ...settingsFormatting,
      ...(config.formatting || {}),
    };

    const result = await runReportQuery(orgId(req), config, { page: 1, limit: 5000 });

    let payload = '';
    let contentType = 'text/plain';
    let encoding = 'utf8';
    let status = 'completed';
    let error = '';
    let fileExt = format;

    if (format === 'csv') {
      payload = rowsToCsv(result);
      contentType = 'text/csv';
    } else if (format === 'json') {
      payload = JSON.stringify(
        {
          name: reportName,
          companyName: String(settings.branding?.companyName || '').trim(),
          header: formatting.header || settings.branding?.companyName || '',
          footer: formatting.footer || '',
          watermark: formatting.watermark || '',
          visualization: result.visualization,
          chart: result.chart,
          columns: result.columns,
          rows: result.rows,
          aggregates: result.aggregates,
          groups: result.groups,
        },
        null,
        2
      );
      contentType = 'application/json';
    } else if (format === 'pdf' || format === 'print') {
      const branding = {
        companyName: String(settings.branding?.companyName || '').trim(),
        logoData: String(settings.branding?.logoData || ''),
      };
      const buffer = await buildReportPdfBuffer({
        reportName,
        result,
        formatting,
        branding,
      });
      payload = buffer.toString('base64');
      contentType = 'application/pdf';
      encoding = 'base64';
      fileExt = 'pdf';
    } else if (format === 'xlsx' || format === 'docx') {
      payload = rowsToCsv(result);
      contentType = 'text/csv';
      fileExt = 'csv';
    } else {
      return res.status(400).json({ message: `Unsupported format: ${format}` });
    }

    const fileName = buildExportFilename(settings.defaultFilenameFormat, reportName, fileExt);

    const exportDoc = await ReportExport.create({
      organizationId: orgId(req),
      reportId: req.body.reportId || undefined,
      reportName,
      generatedBy: req.user._id,
      format,
      recordCount: result.total,
      status,
      error,
      fileName,
      contentType,
      payload,
      configSnapshot: config,
    });

    await pruneExportHistory(orgId(req));

    await auditReport(
      req,
      AUDIT_ACTIONS.REPORT_GENERATED,
      exportDoc._id,
      reportName,
      [
        { field: 'format', label: 'Export format', to: format },
        { field: 'fileName', label: 'File name', to: fileName },
        {
          field: 'recordCount',
          label: 'Records',
          to: String(result.total ?? 0),
        },
        ...(req.body.reportId
          ? [{ field: 'reportId', label: 'Report ID', to: String(req.body.reportId) }]
          : []),
      ],
      {
        description: `Exported “${reportName}” as ${format.toUpperCase()}`,
        extra: { format, recordCount: result.total, fileName, exportType: format },
      }
    );

    res.json({
      export: {
        _id: exportDoc._id,
        reportName: exportDoc.reportName,
        format: exportDoc.format,
        recordCount: exportDoc.recordCount,
        status: exportDoc.status,
        fileName: exportDoc.fileName,
        createdAt: exportDoc.createdAt,
      },
      download: {
        fileName,
        contentType,
        content: payload,
        encoding,
      },
      result: {
        total: result.total,
        columns: result.columns,
        aggregates: result.aggregates,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/field-values', async (req, res) => {
  try {
    const source = String(req.query.source || 'assets');
    const field = String(req.query.field || '');
    if (!field) return res.status(400).json({ message: 'field is required' });
    const values = await getDistinctFieldValues(
      orgId(req),
      source,
      field,
      String(req.query.q || ''),
      Math.min(80, Number(req.query.limit) || 40)
    );
    res.json({ values });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// —— Definitions (saved / drafts / templates) ——
router.get('/definitions', async (req, res) => {
  try {
    const kind = req.query.kind;
    const q = { organizationId: orgId(req) };
    if (kind) q.kind = kind;
    else q.kind = { $in: ['saved', 'draft', 'template'] };

    const filter = {
      ...q,
      $or: [
        { ownerId: req.user._id },
        { scope: 'organization' },
        { published: true },
        { kind: 'template' },
      ],
    };

    const items = await ReportDefinition.find(filter).sort({ updatedAt: -1 }).lean();
    res.json({ definitions: items });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/definitions/:id', async (req, res) => {
  try {
    const doc = await ReportDefinition.findById(req.params.id).lean();
    if (!canAccessDefinition(doc, req.user)) return res.status(404).json({ message: 'Not found' });
    res.json(doc);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/definitions', requireTabWrite('reports'), async (req, res) => {
  try {
    const body = req.body || {};
    const doc = await ReportDefinition.create({
      organizationId: orgId(req),
      name: body.name || 'Untitled report',
      description: body.description || '',
      kind: body.kind || 'saved',
      scope: body.scope || 'user',
      ownerId: req.user._id,
      category: body.category || '',
      quickKey: body.quickKey,
      published: Boolean(body.published),
      config: normalizeConfig(body.config),
    });

    const kindLabel =
      doc.kind === 'template' ? 'template' : doc.kind === 'draft' ? 'draft' : 'saved report';
    const skipAudit = body.autosave === true || body.skipAudit === true || doc.kind === 'draft';
    if (!skipAudit) {
      await auditReport(req, 'created', doc._id, doc.name, snapshotDefinitionFields(doc), {
        description: `Saved ${kindLabel}: ${doc.name}`,
        extra: { kind: doc.kind, scope: doc.scope },
      });
    }

    res.status(201).json(doc);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.patch('/definitions/:id', requireTabWrite('reports'), async (req, res) => {
  try {
    const doc = await ReportDefinition.findById(req.params.id);
    if (!canAccessDefinition(doc, req.user)) return res.status(404).json({ message: 'Not found' });

    const before = doc.toObject();
    const body = req.body || {};
    if (body.name !== undefined) doc.name = body.name;
    if (body.description !== undefined) doc.description = body.description;
    if (body.kind !== undefined) doc.kind = body.kind;
    if (body.scope !== undefined) doc.scope = body.scope;
    if (body.category !== undefined) doc.category = body.category;
    if (body.published !== undefined) doc.published = body.published;
    if (body.config !== undefined) {
      // Replace nested config wholesale so calculations / visualization / formatting persist
      doc.set('config', normalizeConfig(body.config));
      doc.markModified('config');
    }
    await doc.save();

    const skipAudit = body.autosave === true || body.skipAudit === true || doc.kind === 'draft';
    const changes = diffReportDefinition(before, doc.toObject());
    if (!skipAudit && changes.length) {
      const kindLabel =
        doc.kind === 'template' ? 'template' : doc.kind === 'draft' ? 'draft' : 'saved report';
      await auditReport(req, 'updated', doc._id, doc.name, changes, {
        description: formatReportFieldChangesSummary(`${kindLabel} “${doc.name}”`, changes),
        extra: { kind: doc.kind },
      });
    }

    res.json(doc.toObject());
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/definitions/:id/duplicate', requireTabWrite('reports'), async (req, res) => {
  try {
    const doc = await ReportDefinition.findById(req.params.id).lean();
    if (!canAccessDefinition(doc, req.user)) return res.status(404).json({ message: 'Not found' });

    const copy = await ReportDefinition.create({
      organizationId: orgId(req),
      name: `${doc.name} (copy)`,
      description: doc.description,
      kind: req.body.kind || 'saved',
      scope: 'user',
      ownerId: req.user._id,
      category: doc.category,
      config: doc.config,
      published: false,
    });

    await auditReport(
      req,
      'duplicated',
      copy._id,
      copy.name,
      [
        { field: 'source', label: 'Duplicated from', from: '(empty)', to: doc.name },
        { field: 'kind', label: 'Kind', from: '(empty)', to: copy.kind },
        ...snapshotDefinitionFields(copy).filter((c) => c.field !== 'kind'),
      ],
      {
        description: `Duplicated report “${doc.name}” → “${copy.name}”`,
        extra: { sourceId: String(doc._id), kind: copy.kind },
      }
    );

    res.status(201).json(copy);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/definitions/:id/favourite', async (req, res) => {
  try {
    const doc = await ReportDefinition.findById(req.params.id);
    if (!canAccessDefinition(doc, req.user)) return res.status(404).json({ message: 'Not found' });

    const uid = String(req.user._id);
    const has = doc.favouriteBy.some((id) => String(id) === uid);
    if (has) doc.favouriteBy = doc.favouriteBy.filter((id) => String(id) !== uid);
    else doc.favouriteBy.push(req.user._id);
    await doc.save();
    res.json({ favourite: !has, favouriteBy: doc.favouriteBy });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.delete('/definitions/:id', requireTabWrite('reports'), async (req, res) => {
  try {
    const doc = await ReportDefinition.findById(req.params.id);
    if (!canAccessDefinition(doc, req.user)) return res.status(404).json({ message: 'Not found' });
    await doc.deleteOne();
    await auditReport(
      req,
      'deleted',
      doc._id,
      doc.name,
      [
        { field: 'name', label: 'Name', from: doc.name, to: '(deleted)' },
        { field: 'kind', label: 'Kind', from: doc.kind, to: '(deleted)' },
      ],
      {
        description: `Deleted ${doc.kind}: ${doc.name}`,
        severity: 'medium',
        extra: { kind: doc.kind },
      }
    );
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/quick/:key/save', requireTabWrite('reports'), async (req, res) => {
  try {
    const preset = getQuickReportPreset(req.params.key);
    if (!preset) return res.status(404).json({ message: 'Quick report not found' });
    const kind = req.body.kind === 'template' ? 'template' : 'saved';
    const doc = await ReportDefinition.create({
      organizationId: orgId(req),
      name: req.body.name || preset.name,
      description: preset.description,
      kind,
      scope: kind === 'template' ? 'organization' : 'user',
      ownerId: req.user._id,
      category: preset.category,
      quickKey: preset.key,
      published: kind === 'template',
      config: normalizeConfig(preset.config),
    });

    await auditReport(
      req,
      'created',
      doc._id,
      doc.name,
      [
        {
          field: 'quickKey',
          label: 'Saved from quick report',
          from: '(empty)',
          to: preset.key,
        },
        ...snapshotDefinitionFields(doc),
      ],
      {
        description:
          kind === 'template'
            ? `Saved template from quick report “${preset.name}”`
            : `Saved report from quick report “${preset.name}”`,
        extra: { kind, quickKey: preset.key },
      }
    );

    res.status(201).json(doc);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// —— Schedules ——
router.get('/schedules', async (req, res) => {
  try {
    const items = await ReportSchedule.find({ organizationId: orgId(req) })
      .sort({ updatedAt: -1 })
      .populate('reportId', 'name kind')
      .populate('createdBy', 'name email')
      .lean();
    res.json({ schedules: items });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/schedules', requireTabWrite('reports'), async (req, res) => {
  try {
    const body = req.body || {};
    if (!body.reportId) return res.status(400).json({ message: 'reportId is required' });
    const report = await ReportDefinition.findById(body.reportId);
    if (!canAccessDefinition(report, req.user)) return res.status(404).json({ message: 'Report not found' });

    const doc = await ReportSchedule.create({
      organizationId: orgId(req),
      reportId: body.reportId,
      name: body.name || `${report.name} schedule`,
      createdBy: req.user._id,
      enabled: body.enabled !== false,
      frequency: body.frequency || 'weekly',
      dayOfWeek: body.dayOfWeek,
      dayOfMonth: body.dayOfMonth,
      timeOfDay: body.timeOfDay || '09:00',
      timezone: body.timezone || 'Asia/Kolkata',
      exportFormat: body.exportFormat || 'csv',
      recipients: body.recipients || [],
      lastStatus: 'pending',
    });

    await auditReport(
      req,
      'created',
      doc._id,
      doc.name,
      snapshotScheduleFields({
        ...doc.toObject(),
        reportId: report.name || String(doc.reportId),
      }),
      {
        description: `Scheduled report “${report.name}” (${doc.frequency}, ${doc.exportFormat})`,
        extra: {
          scheduleId: String(doc._id),
          reportId: String(doc.reportId),
          frequency: doc.frequency,
          exportFormat: doc.exportFormat,
        },
      }
    );

    res.status(201).json(doc);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.patch('/schedules/:id', requireTabWrite('reports'), async (req, res) => {
  try {
    const doc = await ReportSchedule.findOne({ _id: req.params.id, organizationId: orgId(req) });
    if (!doc) return res.status(404).json({ message: 'Not found' });
    const before = doc.toObject();
    const fields = [
      'name',
      'enabled',
      'frequency',
      'dayOfWeek',
      'dayOfMonth',
      'timeOfDay',
      'timezone',
      'exportFormat',
      'recipients',
    ];
    for (const f of fields) {
      if (req.body[f] !== undefined) doc[f] = req.body[f];
    }
    await doc.save();

    const changes = diffReportSchedule(before, doc.toObject());
    if (changes.length) {
      await auditReport(req, 'updated', doc._id, doc.name, changes, {
        description: formatReportFieldChangesSummary(`schedule “${doc.name}”`, changes),
        extra: { scheduleId: String(doc._id), reportId: String(doc.reportId) },
      });
    }

    res.json(doc);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.delete('/schedules/:id', requireTabWrite('reports'), async (req, res) => {
  try {
    const doc = await ReportSchedule.findOneAndDelete({ _id: req.params.id, organizationId: orgId(req) });
    if (!doc) return res.status(404).json({ message: 'Not found' });

    await auditReport(
      req,
      'deleted',
      doc._id,
      doc.name,
      [
        { field: 'name', label: 'Name', from: doc.name, to: '(deleted)' },
        { field: 'frequency', label: 'Frequency', from: doc.frequency, to: '(deleted)' },
        { field: 'exportFormat', label: 'Export format', from: doc.exportFormat, to: '(deleted)' },
      ],
      {
        description: `Deleted schedule “${doc.name}”`,
        severity: 'medium',
        extra: { scheduleId: String(doc._id), reportId: String(doc.reportId) },
      }
    );

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// —— Export history ——
router.get('/exports', async (req, res) => {
  try {
    const q = { organizationId: orgId(req) };
    if (req.query.format) q.format = req.query.format;
    if (req.query.status) q.status = req.query.status;
    if (req.query.search) q.reportName = { $regex: String(req.query.search), $options: 'i' };

    await pruneExportHistory(orgId(req));

    const items = await ReportExport.find(q)
      .sort({ createdAt: -1 })
      .limit(REPORT_EXPORT_HISTORY_LIMIT)
      .populate('generatedBy', 'name email')
      .select('-payload')
      .lean();
    res.json({ exports: items });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/exports/:id/download', async (req, res) => {
  try {
    const doc = await ReportExport.findOne({ _id: req.params.id, organizationId: orgId(req) });
    if (!doc) return res.status(404).json({ message: 'Not found' });
    if (!doc.payload) return res.status(410).json({ message: 'Export payload expired' });

    await auditReport(
      req,
      AUDIT_ACTIONS.REPORT_DOWNLOADED,
      doc._id,
      doc.reportName,
      [
        { field: 'format', label: 'Export format', to: doc.format },
        { field: 'fileName', label: 'File name', to: doc.fileName || '' },
      ],
      {
        description: `Re-downloaded export “${doc.fileName}” (${String(doc.format || '').toUpperCase()})`,
        extra: { format: doc.format, fileName: doc.fileName, exportType: doc.format },
      }
    );

    res.json({
      fileName: doc.fileName,
      contentType: doc.contentType,
      content: doc.payload,
      format: doc.format,
      encoding: doc.contentType === 'application/pdf' ? 'base64' : 'utf8',
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// —— Settings ——
router.get('/settings', async (req, res) => {
  try {
    const settings = await getSettings(orgId(req));
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.patch('/settings', requireTabWrite('reports'), async (req, res) => {
  try {
    const settings = await getSettings(orgId(req));
    const before = settings.toObject();
    const body = req.body || {};
    if (body.defaultFilenameFormat !== undefined) settings.defaultFilenameFormat = body.defaultFilenameFormat;
    if (body.defaultFormatting !== undefined && typeof body.defaultFormatting === 'object') {
      const prevFmt = settings.defaultFormatting?.toObject?.() || settings.defaultFormatting || {};
      const nextFmt = { ...prevFmt, ...body.defaultFormatting };
      settings.defaultFormatting = {
        header: String(nextFmt.header ?? ''),
        footer: String(nextFmt.footer ?? ''),
        watermark: String(nextFmt.watermark ?? ''),
        orientation: nextFmt.orientation === 'portrait' ? 'portrait' : 'landscape',
        paperSize: ['a4', 'letter', 'legal', 'a3'].includes(String(nextFmt.paperSize || '').toLowerCase())
          ? String(nextFmt.paperSize).toLowerCase()
          : 'a4',
      };
    }
    if (body.branding !== undefined && typeof body.branding === 'object') {
      const prevBranding = settings.branding?.toObject?.() || settings.branding || {};
      const nextBranding = { ...prevBranding, ...body.branding };
      const logoData = nextBranding.logoData != null ? String(nextBranding.logoData) : '';
      if (logoData && logoData.length > REPORT_LOGO_MAX_CHARS) {
        return res.status(400).json({ message: 'Logo file is too large. Use an image under ~500KB.' });
      }
      if (logoData && !/^data:image\/(png|jpe?g);base64,/i.test(logoData)) {
        return res.status(400).json({ message: 'Logo must be a PNG or JPEG image (PDF export does not support WebP/GIF).' });
      }
      settings.branding = {
        companyName: String(nextBranding.companyName ?? ''),
        logoData,
      };
    }
    await settings.save();

    const changes = diffReportSettings(before, settings.toObject());
    if (changes.length) {
      await auditReport(req, 'settings_changed', settings._id, 'Report Studio settings', changes, {
        description: formatReportFieldChangesSummary('Report Studio settings', changes),
        severity: 'medium',
      });
    }

    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
