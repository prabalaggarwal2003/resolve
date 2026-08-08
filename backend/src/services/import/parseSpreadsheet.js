import * as XLSX from 'xlsx';

const MAX_ROWS = 20000;
const MAX_PREVIEW = 8;
const MAX_FILE_BYTES = 12 * 1024 * 1024; // 12MB

export function detectFileType(fileName = '', mime = '') {
  const lower = String(fileName).toLowerCase();
  if (lower.endsWith('.csv') || mime.includes('csv')) return 'csv';
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls') || mime.includes('sheet') || mime.includes('excel')) {
    return 'xlsx';
  }
  return null;
}

function detectType(samples = []) {
  const nonEmpty = samples.map((s) => String(s ?? '').trim()).filter(Boolean);
  if (!nonEmpty.length) return 'text';
  const dateLike = nonEmpty.filter((v) => !Number.isNaN(Date.parse(v)) && /[-/]/.test(v)).length;
  if (dateLike / nonEmpty.length >= 0.6) return 'date';
  const numLike = nonEmpty.filter((v) => /^-?[\d,]+(\.\d+)?$/.test(v.replace(/[₹$€£,\s]/g, ''))).length;
  if (numLike / nonEmpty.length >= 0.7) return 'number';
  const boolLike = nonEmpty.filter((v) => /^(true|false|yes|no|y|n|1|0)$/i.test(v)).length;
  if (boolLike === nonEmpty.length) return 'boolean';
  return 'text';
}

function sheetToMatrix(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: '',
    raw: false,
    blankrows: false,
  });
}

function matrixToRecords(matrix) {
  if (!matrix.length) return { headers: [], rows: [], previewRows: [] };
  const headerRow = matrix[0].map((h, i) => {
    const label = String(h ?? '').trim() || `Column ${i + 1}`;
    return { key: label, label };
  });

  // Deduplicate header keys
  const seen = new Map();
  const headers = headerRow.map((h) => {
    const base = h.key;
    const count = seen.get(base) || 0;
    seen.set(base, count + 1);
    const key = count === 0 ? base : `${base} (${count + 1})`;
    return { key, label: key };
  });

  const dataRows = matrix.slice(1).filter((row) =>
    row.some((cell) => String(cell ?? '').trim() !== '')
  );

  if (dataRows.length > MAX_ROWS) {
    const err = new Error(`File has too many rows (max ${MAX_ROWS}). Split the file and try again.`);
    err.status = 400;
    throw err;
  }

  const rows = dataRows.map((row) => {
    const obj = {};
    headers.forEach((h, i) => {
      obj[h.key] = row[i] == null ? '' : String(row[i]);
    });
    return obj;
  });

  const enrichedHeaders = headers.map((h) => {
    const samples = rows.slice(0, 20).map((r) => r[h.key]);
    return {
      key: h.key,
      label: h.label,
      sampleValues: samples.filter((s) => String(s).trim()).slice(0, 5),
      detectedType: detectType(samples),
    };
  });

  return {
    headers: enrichedHeaders,
    rows,
    previewRows: rows.slice(0, MAX_PREVIEW),
  };
}

export function parseSpreadsheetBuffer(buffer, fileName, options = {}) {
  if (!buffer || !buffer.length) {
    const err = new Error('Empty file');
    err.status = 400;
    throw err;
  }
  if (buffer.length > MAX_FILE_BYTES) {
    const err = new Error('File is too large (max 12 MB).');
    err.status = 400;
    throw err;
  }

  const fileType = detectFileType(fileName) || 'xlsx';
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true, raw: false });
  const sheetNames = workbook.SheetNames || [];
  if (!sheetNames.length) {
    const err = new Error('No worksheets found in the file.');
    err.status = 400;
    throw err;
  }

  const sheetName = options.sheetName && sheetNames.includes(options.sheetName)
    ? options.sheetName
    : sheetNames[0];

  const matrix = sheetToMatrix(workbook, sheetName);
  const { headers, rows, previewRows } = matrixToRecords(matrix);

  return {
    fileType: fileName.toLowerCase().endsWith('.csv') ? 'csv' : fileType,
    sheetNames,
    sheetName,
    headers,
    rows,
    previewRows,
    rowCount: rows.length,
  };
}

export function buildTemplateCsv(destinationFields = []) {
  const headers = destinationFields.map((f) => f.label || f.key);
  const example = destinationFields.map((f) => {
    if (f.key === 'assetId') return 'AST-001';
    if (f.key === 'name') return 'Example Asset';
    if (f.key === 'status') return (f.options && f.options[0]) || 'available';
    if (f.type === 'date' || f.key.includes('Date') || f.key.includes('Expiry')) return '2024-01-15';
    if (f.type === 'number' || f.key === 'cost') return '1000';
    if (f.relationship === 'location') return 'Head Office';
    if (f.relationship === 'department') return 'IT';
    if (f.relationship === 'partner') return 'Acme Supplies';
    return '';
  });
  const escape = (v) => {
    const s = String(v ?? '');
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  return [headers.map(escape).join(','), example.map(escape).join(',')].join('\n');
}

export { MAX_ROWS, MAX_PREVIEW, MAX_FILE_BYTES };
