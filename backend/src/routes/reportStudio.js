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
import { DEFAULT_REPORT_STUDIO_SETTINGS } from '../constants/reportStudioDefaults.js';
import { logAudit, getRequestMetadata, AUDIT_ACTIONS, AUDIT_RESOURCES } from '../services/auditService.js';

const router = express.Router();
router.use(protect);
router.use(requireTabRead('reports'));

function orgId(req) {
  return req.user.organizationId;
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
  }
  return settings;
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
    const formatting = {
      ...(settings.branding ? {} : {}),
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
      const buffer = await buildReportPdfBuffer({
        reportName,
        result,
        formatting,
        branding: settings.branding || {},
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

    await logAudit(req.user._id, AUDIT_ACTIONS.REPORT_GENERATED, AUDIT_RESOURCES.REPORT, exportDoc._id, {
      resourceName: reportName,
      description: `Exported report as ${format}`,
      details: { format, recordCount: result.total, fileName },
      severity: 'low',
      ...getRequestMetadata(req),
    });

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

    await logAudit(req.user._id, 'created', AUDIT_RESOURCES.REPORT, doc._id, {
      resourceName: doc.name,
      description: `Created report definition (${doc.kind})`,
      severity: 'low',
      ...getRequestMetadata(req),
    });

    res.status(201).json(doc);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.patch('/definitions/:id', requireTabWrite('reports'), async (req, res) => {
  try {
    const doc = await ReportDefinition.findById(req.params.id);
    if (!canAccessDefinition(doc, req.user)) return res.status(404).json({ message: 'Not found' });

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

    await logAudit(req.user._id, 'updated', AUDIT_RESOURCES.REPORT, doc._id, {
      resourceName: doc.name,
      description: 'Updated report definition',
      severity: 'low',
      ...getRequestMetadata(req),
    });

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
    await logAudit(req.user._id, 'deleted', AUDIT_RESOURCES.REPORT, doc._id, {
      resourceName: doc.name,
      description: 'Deleted report definition',
      severity: 'medium',
      ...getRequestMetadata(req),
    });
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
    res.status(201).json(doc);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.patch('/schedules/:id', requireTabWrite('reports'), async (req, res) => {
  try {
    const doc = await ReportSchedule.findOne({ _id: req.params.id, organizationId: orgId(req) });
    if (!doc) return res.status(404).json({ message: 'Not found' });
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
    res.json(doc);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.delete('/schedules/:id', requireTabWrite('reports'), async (req, res) => {
  try {
    const doc = await ReportSchedule.findOneAndDelete({ _id: req.params.id, organizationId: orgId(req) });
    if (!doc) return res.status(404).json({ message: 'Not found' });
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

    const items = await ReportExport.find(q)
      .sort({ createdAt: -1 })
      .limit(Math.min(200, Number(req.query.limit) || 50))
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

    await logAudit(req.user._id, AUDIT_ACTIONS.REPORT_DOWNLOADED, AUDIT_RESOURCES.REPORT, doc._id, {
      resourceName: doc.reportName,
      description: `Re-downloaded export ${doc.fileName}`,
      details: { format: doc.format, fileName: doc.fileName },
      severity: 'low',
      ...getRequestMetadata(req),
    });

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
    const body = req.body || {};
    if (body.defaultExportFormat !== undefined) settings.defaultExportFormat = body.defaultExportFormat;
    if (body.timezone !== undefined) settings.timezone = body.timezone;
    if (body.currency !== undefined) settings.currency = body.currency;
    if (body.defaultFilenameFormat !== undefined) settings.defaultFilenameFormat = body.defaultFilenameFormat;
    if (body.retentionDays !== undefined) settings.retentionDays = body.retentionDays;
    if (body.branding !== undefined) {
      settings.branding = { ...settings.branding?.toObject?.() || settings.branding || {}, ...body.branding };
    }
    await settings.save();

    await logAudit(req.user._id, 'settings_changed', AUDIT_RESOURCES.REPORT, settings._id, {
      resourceName: 'Report Studio settings',
      description: 'Updated Report Studio settings',
      severity: 'medium',
      ...getRequestMetadata(req),
    });

    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
