import express from 'express';
import multer from 'multer';
import { protect } from '../middleware/auth.js';
import { canEdit, canRead } from '../services/permissions.js';
import { AssetTemplate } from '../models/index.js';
import ImportJob from '../models/ImportJob.js';
import ImportJobRow from '../models/ImportJobRow.js';
import ImportMapping from '../models/ImportMapping.js';
import { parseSpreadsheetBuffer, buildTemplateCsv } from '../services/import/parseSpreadsheet.js';
import { getAssetImportCatalog } from '../services/import/assetImportCatalog.js';
import { suggestTargetField } from '../services/import/importAliases.js';
import { validateImportJob } from '../services/import/validateAssetImport.js';
import { executeAssetImport } from '../services/import/executeAssetImport.js';
import { mapToObject } from '../services/import/transformValues.js';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 },
});

router.use(protect);

function requireAssetRead(req, res, next) {
  if (!canRead(req.user, 'assets', req)) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  next();
}

function requireAssetWrite(req, res, next) {
  if (!canEdit(req.user, 'assets', req)) {
    return res.status(403).json({ message: 'Forbidden: you do not have permission to import assets' });
  }
  next();
}

async function loadJob(req, { withBuffer = false } = {}) {
  const q = ImportJob.findOne({
    _id: req.params.jobId,
    organizationId: req.user.organizationId,
    module: 'assets',
  });
  if (withBuffer) q.select('+fileBuffer');
  const job = await q;
  return job;
}

/** List asset templates + optional mapping suggestions for import setup */
router.get('/catalog', requireAssetRead, async (req, res) => {
  try {
    const templates = await AssetTemplate.find({ organizationId: req.user.organizationId })
      .select('_id name isDefault statuses fields groupId')
      .sort({ sortOrder: 1, name: 1 })
      .lean();
    const catalog = await getAssetImportCatalog(req.user.organizationId, req.query.templateId);
    res.json({ templates, catalog });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/** Download Resolve-format CSV template for a selected asset template */
router.get('/template.csv', requireAssetRead, async (req, res) => {
  try {
    const catalog = await getAssetImportCatalog(req.user.organizationId, req.query.templateId);
    const csv = buildTemplateCsv(catalog.destinationFields);
    const name = (catalog.template?.name || 'assets').replace(/[^\w\-]+/g, '_');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="resolve-${name}-import-template.csv"`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/** Upload CSV/XLSX — parse headers + preview; store rows server-side */
router.post('/upload', requireAssetWrite, upload.single('file'), async (req, res) => {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({ message: 'Please upload a CSV or Excel (.xlsx) file.' });
    }
    const sheetName = req.body.sheetName || undefined;
    const parsed = parseSpreadsheetBuffer(req.file.buffer, req.file.originalname, { sheetName });

    if (!parsed.rowCount) {
      return res.status(400).json({ message: 'No data rows found. Check that the first row contains column headers.' });
    }

    const job = await ImportJob.create({
      organizationId: req.user.organizationId,
      module: 'assets',
      fileName: req.file.originalname,
      fileType: parsed.fileType,
      sheetNames: parsed.sheetNames,
      sheetName: parsed.sheetName,
      fileBuffer: req.file.buffer,
      headers: parsed.headers,
      rowCount: parsed.rowCount,
      previewRows: parsed.previewRows,
      status: 'uploaded',
      wizardStep: 'configure',
      createdBy: req.user._id,
    });

    const rowDocs = parsed.rows.map((raw, rowIndex) => ({
      jobId: job._id,
      organizationId: req.user.organizationId,
      rowIndex,
      raw,
      status: 'pending',
    }));
    if (rowDocs.length) await ImportJobRow.insertMany(rowDocs, { ordered: false });

    res.status(201).json({
      job: serializeJob(job),
      headers: parsed.headers,
      previewRows: parsed.previewRows,
      rowCount: parsed.rowCount,
      sheetNames: parsed.sheetNames,
      sheetName: parsed.sheetName,
    });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || 'Upload failed' });
  }
});

/** Change worksheet for an uploaded XLSX job */
router.post('/:jobId/sheet', requireAssetWrite, async (req, res) => {
  try {
    const job = await loadJob(req, { withBuffer: true });
    if (!job) return res.status(404).json({ message: 'Import job not found' });
    if (!job.fileBuffer) {
      return res.status(400).json({ message: 'Original file is no longer available. Please upload again.' });
    }
    const sheetName = req.body.sheetName;
    if (!sheetName || !(job.sheetNames || []).includes(sheetName)) {
      return res.status(400).json({ message: 'Invalid worksheet name.' });
    }

    const parsed = parseSpreadsheetBuffer(job.fileBuffer, job.fileName, { sheetName });
    await ImportJobRow.deleteMany({ jobId: job._id });

    job.sheetName = parsed.sheetName;
    job.headers = parsed.headers;
    job.rowCount = parsed.rowCount;
    job.previewRows = parsed.previewRows;
    job.status = 'uploaded';
    job.columnMappings = [];
    job.validationSummary = { valid: 0, warnings: 0, errors: 0 };
    await job.save();

    const rowDocs = parsed.rows.map((raw, rowIndex) => ({
      jobId: job._id,
      organizationId: req.user.organizationId,
      rowIndex,
      raw,
      status: 'pending',
    }));
    if (rowDocs.length) await ImportJobRow.insertMany(rowDocs, { ordered: false });

    res.json({
      job: serializeJob(job),
      headers: parsed.headers,
      previewRows: parsed.previewRows,
      rowCount: parsed.rowCount,
      sheetNames: parsed.sheetNames,
      sheetName: parsed.sheetName,
    });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
});

/** Configure template + duplicate handling */
router.put('/:jobId/configure', requireAssetWrite, async (req, res) => {
  try {
    const job = await loadJob(req);
    if (!job) return res.status(404).json({ message: 'Import job not found' });

    const { templateId, duplicateHandling, wizardStep } = req.body || {};
    if (templateId) {
      const tpl = await AssetTemplate.findOne({ _id: templateId, organizationId: req.user.organizationId });
      if (!tpl) return res.status(400).json({ message: 'Asset template not found' });
      job.templateId = tpl._id;
    }
    // Do not auto-assign a fallback template — category mapping drives template per row
    if (duplicateHandling) job.duplicateHandling = duplicateHandling;
    job.status = 'configured';
    job.wizardStep = wizardStep || 'map';
    await job.save();

    const catalog = await getAssetImportCatalog(req.user.organizationId, job.templateId || null);
    const suggestions = (job.headers || []).map((h) => {
      const target = suggestTargetField(h.key, catalog.destinationFields);
      return {
        sourceColumn: h.key,
        targetField: target || '',
        ignored: false,
        suggested: Boolean(target),
      };
    });

    // Auto-apply suggestions only if mappings empty
    if (!job.columnMappings?.length) {
      job.columnMappings = suggestions;
      await job.save();
    }

    // Suggest saved mapping by header signature
    const headerKeys = (job.headers || []).map((h) => h.key);
    const saved = await ImportMapping.find({
      organizationId: req.user.organizationId,
      module: 'assets',
    })
      .sort({ updatedAt: -1 })
      .lean();
    const match = saved.find((m) => sameHeaderSet(m.sourceHeaders || [], headerKeys));

    res.json({
      job: serializeJob(job),
      catalog,
      suggestedMappings: suggestions,
      suggestedSavedMapping: match ? serializeMapping(match) : null,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/** Save column/value/relationship mappings on the job */
router.put('/:jobId/mappings', requireAssetWrite, async (req, res) => {
  try {
    const job = await loadJob(req);
    if (!job) return res.status(404).json({ message: 'Import job not found' });

    const {
      columnMappings,
      valueMappings,
      transforms,
      relationshipRules,
      duplicateHandling,
      savedMappingId,
      wizardStep,
    } = req.body || {};

    if (Array.isArray(columnMappings)) job.columnMappings = columnMappings;
    if (valueMappings) job.valueMappings = valueMappings;
    if (transforms) job.transforms = transforms;
    if (relationshipRules) job.relationshipRules = relationshipRules;
    if (duplicateHandling) job.duplicateHandling = duplicateHandling;
    if (savedMappingId !== undefined) job.savedMappingId = savedMappingId || null;
    if (wizardStep) job.wizardStep = wizardStep;
    job.status = 'mapped';
    await job.save();

    res.json({ job: serializeJob(job) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/** Persist wizard step / resume progress without changing mappings */
router.put('/:jobId/progress', requireAssetWrite, async (req, res) => {
  try {
    const job = await loadJob(req);
    if (!job) return res.status(404).json({ message: 'Import job not found' });
    const { wizardStep, duplicateHandling } = req.body || {};
    const allowed = ['upload', 'configure', 'map', 'values', 'validate', 'preview', 'import'];
    if (wizardStep && allowed.includes(wizardStep)) job.wizardStep = wizardStep;
    if (duplicateHandling) job.duplicateHandling = duplicateHandling;
    await job.save();
    res.json({ job: serializeJob(job) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/** Validate all rows */
router.post('/:jobId/validate', requireAssetWrite, async (req, res) => {
  try {
    const job = await loadJob(req);
    if (!job) return res.status(404).json({ message: 'Import job not found' });
    // templateId optional — row category drives template on execute
    if (!(job.columnMappings || []).some((m) => !m.ignored && m.targetField)) {
      return res.status(400).json({ message: 'Map at least one column to a Resolve field.' });
    }

    const catalog = await getAssetImportCatalog(req.user.organizationId, job.templateId || null);
    const rows = await ImportJobRow.find({ jobId: job._id }).sort({ rowIndex: 1 }).lean();
    const { summary, rows: updated } = await validateImportJob({ job, rows, catalog });

    const bulk = updated.map((r) => ({
      updateOne: {
        filter: { _id: r._id },
        update: { $set: { mapped: r.mapped, status: r.status, issues: r.issues } },
      },
    }));
    if (bulk.length) await ImportJobRow.bulkWrite(bulk, { ordered: false });

    job.validationSummary = summary;
    job.status = 'validated';
    job.wizardStep = 'validate';
    await job.save();

    const sample = await ImportJobRow.find({ jobId: job._id })
      .sort({ rowIndex: 1 })
      .limit(50)
      .lean();

    const errorSample = await ImportJobRow.find({ jobId: job._id, status: 'error' })
      .sort({ rowIndex: 1 })
      .limit(100)
      .lean();

    res.json({
      job: serializeJob(job),
      summary,
      previewRows: sample.map(serializeRow),
      errorRows: errorSample.map(serializeRow),
    });
  } catch (err) {
    console.error('Import validate error:', err);
    res.status(500).json({ message: err.message });
  }
});

/** Preview page of mapped rows */
router.get('/:jobId/rows', requireAssetRead, async (req, res) => {
  try {
    const job = await loadJob(req);
    if (!job) return res.status(404).json({ message: 'Import job not found' });
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
    const status = req.query.status;
    const filter = { jobId: job._id };
    if (status) filter.status = status;
    const [rows, total] = await Promise.all([
      ImportJobRow.find(filter)
        .sort({ rowIndex: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      ImportJobRow.countDocuments(filter),
    ]);
    res.json({ rows: rows.map(serializeRow), total, page, limit });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/** Execute import */
router.post('/:jobId/execute', requireAssetWrite, async (req, res) => {
  try {
    const job = await loadJob(req);
    if (!job) return res.status(404).json({ message: 'Import job not found' });
    if (job.status !== 'validated' && job.status !== 'failed') {
      return res.status(400).json({ message: 'Validate the import before running it.' });
    }
    if ((job.validationSummary?.errors || 0) > 0 && !req.body?.allowErrors) {
      // Still allow importing valid rows — errors are skipped
    }

    job.status = 'importing';
    await job.save();

    const result = await executeAssetImport(job, req);
    job.result = result;
    job.status = 'completed';
    job.wizardStep = 'import';
    job.fileBuffer = undefined;
    await job.save();

    const failedRows = await ImportJobRow.find({
      jobId: job._id,
      status: { $in: ['failed', 'error'] },
    })
      .sort({ rowIndex: 1 })
      .limit(100)
      .lean();

    res.json({
      job: serializeJob(job),
      result,
      failedRows: failedRows.map(serializeRow),
    });
  } catch (err) {
    console.error('Import execute error:', err);
    try {
      const job = await loadJob(req);
      if (job) {
        job.status = 'failed';
        job.errorMessage = err.message || 'Import failed';
        await job.save();
      }
    } catch {
      /* ignore */
    }
    res.status(500).json({ message: err.message || 'Import failed' });
  }
});

/** Import history (paginated) */
router.get('/history', requireAssetRead, async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
    const filter = {
      organizationId: req.user.organizationId,
      module: 'assets',
      status: { $in: ['completed', 'failed'] },
    };
    const [jobs, total] = await Promise.all([
      ImportJob.find(filter)
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      ImportJob.countDocuments(filter),
    ]);
    res.json({
      jobs: jobs.map(serializeJob),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/history/:jobId', requireAssetRead, async (req, res) => {
  try {
    const job = await ImportJob.findOne({
      _id: req.params.jobId,
      organizationId: req.user.organizationId,
      module: 'assets',
    })
      .populate('createdBy', 'name email')
      .lean();
    if (!job) return res.status(404).json({ message: 'Not found' });
    res.json({ job: serializeJob(job) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/** Download failed/error rows as CSV */
router.get('/:jobId/errors.csv', requireAssetRead, async (req, res) => {
  try {
    const job = await loadJob(req);
    if (!job) return res.status(404).json({ message: 'Import job not found' });
    const rows = await ImportJobRow.find({
      jobId: job._id,
      status: { $in: ['error', 'failed'] },
    })
      .sort({ rowIndex: 1 })
      .lean();

    const headers = ['Row', 'Status', 'Issues', ...(job.headers || []).map((h) => h.key)];
    const escape = (v) => {
      const s = String(v ?? '');
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const lines = [headers.map(escape).join(',')];
    for (const row of rows) {
      const issues = (row.issues || []).map((i) => i.message).join(' | ');
      const cols = [
        row.rowIndex + 1,
        row.status,
        issues,
        ...(job.headers || []).map((h) => row.raw?.[h.key] ?? ''),
      ];
      lines.push(cols.map(escape).join(','));
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="import-errors-${String(job._id).slice(-6)}.csv"`
    );
    res.send(lines.join('\n'));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/** Saved mappings CRUD */
router.get('/mappings', requireAssetRead, async (req, res) => {
  try {
    const mappings = await ImportMapping.find({
      organizationId: req.user.organizationId,
      module: 'assets',
    })
      .sort({ updatedAt: -1 })
      .lean();
    res.json({ mappings: mappings.map(serializeMapping) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/mappings', requireAssetWrite, async (req, res) => {
  try {
    const {
      name,
      description,
      templateId,
      sourceHeaders,
      columnMappings,
      valueMappings,
      transforms,
      relationshipRules,
      duplicateHandling,
    } = req.body || {};
    if (!name?.trim()) return res.status(400).json({ message: 'Mapping name is required' });

    const doc = await ImportMapping.findOneAndUpdate(
      {
        organizationId: req.user.organizationId,
        module: 'assets',
        name: name.trim(),
      },
      {
        $set: {
          description: description || '',
          templateId: templateId || null,
          sourceHeaders: sourceHeaders || [],
          columnMappings: columnMappings || [],
          valueMappings: valueMappings || {},
          transforms: transforms || {},
          relationshipRules: relationshipRules || {},
          duplicateHandling: duplicateHandling || 'skip',
          updatedBy: req.user._id,
        },
        $setOnInsert: {
          organizationId: req.user.organizationId,
          module: 'assets',
          createdBy: req.user._id,
        },
      },
      { upsert: true, new: true }
    );
    res.status(201).json({ mapping: serializeMapping(doc) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/mappings/:id', requireAssetWrite, async (req, res) => {
  try {
    await ImportMapping.deleteOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
      module: 'assets',
    });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:jobId', requireAssetRead, async (req, res) => {
  try {
    const job = await loadJob(req);
    if (!job) return res.status(404).json({ message: 'Import job not found' });
    const catalog = await getAssetImportCatalog(req.user.organizationId, job.templateId || null);
    res.json({ job: serializeJob(job), catalog });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

function sameHeaderSet(a = [], b = []) {
  if (a.length !== b.length) return false;
  const sa = [...a].map(String).sort();
  const sb = [...b].map(String).sort();
  return sa.every((v, i) => v === sb[i]);
}

function serializeJob(job) {
  if (!job) return null;
  const o = typeof job.toObject === 'function' ? job.toObject() : { ...job };
  delete o.fileBuffer;
  o.id = String(o._id);
  o.valueMappings = mapToObject(o.valueMappings);
  o.transforms = mapToObject(o.transforms);
  o.relationshipRules = mapToObject(o.relationshipRules);
  if (o.createdBy && typeof o.createdBy === 'object') {
    o.createdBy = { _id: String(o.createdBy._id), name: o.createdBy.name, email: o.createdBy.email };
  }
  return o;
}

function serializeMapping(m) {
  if (!m) return null;
  const o = typeof m.toObject === 'function' ? m.toObject() : { ...m };
  o.id = String(o._id);
  o.valueMappings = mapToObject(o.valueMappings);
  o.transforms = mapToObject(o.transforms);
  o.relationshipRules = mapToObject(o.relationshipRules);
  return o;
}

function serializeRow(row) {
  return {
    id: String(row._id),
    rowIndex: row.rowIndex,
    raw: row.raw,
    mapped: row.mapped,
    status: row.status,
    issues: row.issues || [],
    assetId: row.assetId ? String(row.assetId) : null,
  };
}

export default router;
