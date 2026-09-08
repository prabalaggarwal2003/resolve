import express from 'express';
import multer from 'multer';
import { protect } from '../middleware/auth.js';
import { requireTabRead, requireTabWrite } from '../middleware/tabPermissions.js';
import ImportJob from '../models/ImportJob.js';
import ImportJobRow from '../models/ImportJobRow.js';
import { parseSpreadsheetBuffer, buildTemplateCsv } from '../services/import/parseSpreadsheet.js';
import {
  getEmployeeImportCatalog,
  suggestEmployeeField,
} from '../services/import/employeeImportCatalog.js';
import {
  validateEmployeeImportJob,
  executeEmployeeImport,
} from '../services/import/executeEmployeeImport.js';
import { mapToObject } from '../services/import/transformValues.js';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 },
});

router.use(protect);

async function loadJob(req) {
  return ImportJob.findOne({
    _id: req.params.jobId,
    organizationId: req.user.organizationId,
    module: 'employees',
  });
}

function serializeJob(job) {
  if (!job) return null;
  const o = job.toObject ? job.toObject() : { ...job };
  delete o.fileBuffer;
  o.valueMappings = mapToObject(o.valueMappings);
  o.transforms = mapToObject(o.transforms);
  o.relationshipRules = mapToObject(o.relationshipRules);
  return o;
}

router.get('/catalog', requireTabRead('issues'), (_req, res) => {
  res.json({ catalog: getEmployeeImportCatalog() });
});

router.get('/template.csv', requireTabRead('issues'), (_req, res) => {
  const catalog = getEmployeeImportCatalog();
  const csv = buildTemplateCsv(catalog.destinationFields);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="resolve-employees-import-template.csv"');
  res.send(csv);
});

router.post('/upload', requireTabWrite('issues'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({ message: 'Please upload a CSV or Excel (.xlsx) file.' });
    }
    const parsed = parseSpreadsheetBuffer(req.file.buffer, req.file.originalname);
    if (!parsed.rowCount) {
      return res.status(400).json({ message: 'No data rows found. Check that the first row contains column headers.' });
    }

    const suggestedMappings = (parsed.headers || []).map((h) => {
      const targetField = suggestEmployeeField(h.label || h.key);
      return {
        sourceColumn: h.key,
        targetField,
        ignored: !targetField,
        suggested: Boolean(targetField),
      };
    });

    const job = await ImportJob.create({
      organizationId: req.user.organizationId,
      module: 'employees',
      fileName: req.file.originalname,
      fileType: parsed.fileType,
      sheetNames: parsed.sheetNames,
      sheetName: parsed.sheetName,
      fileBuffer: req.file.buffer,
      headers: parsed.headers,
      rowCount: parsed.rowCount,
      previewRows: parsed.previewRows,
      columnMappings: suggestedMappings,
      duplicateHandling: 'update',
      status: 'uploaded',
      wizardStep: 'map',
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
      suggestedMappings,
      catalog: getEmployeeImportCatalog(),
    });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
});

router.get('/:jobId', requireTabRead('issues'), async (req, res) => {
  try {
    const job = await loadJob(req);
    if (!job) return res.status(404).json({ message: 'Import job not found' });
    res.json({ job: serializeJob(job), catalog: getEmployeeImportCatalog() });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:jobId/rows', requireTabRead('issues'), async (req, res) => {
  try {
    const job = await loadJob(req);
    if (!job) return res.status(404).json({ message: 'Import job not found' });
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const rows = await ImportJobRow.find({ jobId: job._id })
      .sort({ rowIndex: 1 })
      .limit(limit)
      .lean();
    res.json({ rows });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:jobId/mappings', requireTabWrite('issues'), async (req, res) => {
  try {
    const job = await loadJob(req);
    if (!job) return res.status(404).json({ message: 'Import job not found' });
    if (Array.isArray(req.body.columnMappings)) {
      job.columnMappings = req.body.columnMappings;
    }
    if (req.body.duplicateHandling) {
      job.duplicateHandling = req.body.duplicateHandling;
    }
    if (typeof req.body.autoGenerateEmployeeIds === 'boolean') {
      job.autoGenerateEmployeeIds = req.body.autoGenerateEmployeeIds;
    }
    job.status = 'mapped';
    job.wizardStep = 'validate';
    await job.save();
    res.json({ job: serializeJob(job) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/:jobId/validate', requireTabWrite('issues'), async (req, res) => {
  try {
    const result = await validateEmployeeImportJob(req.params.jobId, req.user.organizationId);
    res.json({
      job: serializeJob(result.job),
      summary: result.summary,
    });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
});

router.post('/:jobId/execute', requireTabWrite('issues'), async (req, res) => {
  try {
    const result = await executeEmployeeImport(
      req.params.jobId,
      req.user.organizationId,
      req.user._id
    );
    res.json({ job: serializeJob(result.job), result: result.result });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
});

export default router;
