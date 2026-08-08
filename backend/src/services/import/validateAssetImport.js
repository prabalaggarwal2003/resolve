import Asset from '../../models/Asset.js';
import { mapRawRow, mapToObject, parseDate, parseNumber } from './transformValues.js';
import { suggestConditionValue, ASSET_CONDITION_VALUES } from './importAliases.js';
import { allocateImportAssetIds } from './generateImportAssetId.js';

function normName(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function findEntity(list, value, extraKeys = []) {
  const v = String(value || '').trim();
  if (!v) return null;
  const nv = normName(v);
  return (
    list.find((e) => normName(e.name) === nv) ||
    list.find((e) => extraKeys.some((k) => e[k] && normName(e[k]) === nv)) ||
    list.find((e) => normName(e.name).includes(nv) || nv.includes(normName(e.name))) ||
    null
  );
}

/**
 * Resolve relationship fields according to user rules.
 * Modes: match | create | blank | skip_row
 */
export function resolveRelationships(mapped, catalog, relationshipRules = {}) {
  const issues = [];
  const resolved = { ...mapped };
  const rules = mapToObject(relationshipRules);
  let skipRow = false;

  const handle = (fieldKey, entityType, list, createFlagKey) => {
    if (resolved[fieldKey] == null || resolved[fieldKey] === '') return;
    // Already an id?
    if (/^[a-f0-9]{24}$/i.test(String(resolved[fieldKey]))) return;

    const raw = String(resolved[fieldKey]);
    const rule = rules[fieldKey] || {};
    // Users cannot be auto-created; default blank. Other entities default to create.
    const defaultMode = entityType === 'user' ? 'blank' : 'create';
    const mode = rule.mode || defaultMode;
    const explicit = rule.matches?.[raw] || rule.matches?.[normName(raw)];
    if (explicit === '__blank__') {
      delete resolved[fieldKey];
      return;
    }
    if (explicit && explicit !== '__create__') {
      resolved[fieldKey] = explicit;
      return;
    }

    const found = findEntity(
      list,
      raw,
      entityType === 'partner'
        ? ['code']
        : entityType === 'location'
          ? ['code', 'path']
          : entityType === 'user'
            ? ['email']
            : entityType === 'group'
              ? ['key']
              : []
    );
    if (found) {
      resolved[fieldKey] = found.id;
      resolved[`${fieldKey}__label`] = found.name;
      return;
    }

    if (mode === 'create' || explicit === '__create__') {
      if (entityType === 'user') {
        delete resolved[fieldKey];
        issues.push({
          severity: 'warning',
          field: fieldKey,
          message: `User "${raw}" was not found — left blank (users are not auto-created).`,
        });
        return;
      }
      resolved[createFlagKey] = raw;
      // Drop unresolved name so it cannot be cast as ObjectId at create time
      delete resolved[fieldKey];
      issues.push({
        severity: 'warning',
        field: fieldKey,
        message: `${entityType} "${raw}" was not found and will be created on import.`,
      });
      return;
    }
    if (mode === 'blank') {
      delete resolved[fieldKey];
      issues.push({
        severity: 'warning',
        field: fieldKey,
        message: `${entityType} "${raw}" not found — left blank.`,
      });
      return;
    }
    if (mode === 'skip_row') {
      skipRow = true;
      delete resolved[fieldKey];
      issues.push({
        severity: 'error',
        field: fieldKey,
        message: `${entityType} "${raw}" not found — row will be skipped.`,
      });
      return;
    }

    // match mode: require a decision
    delete resolved[fieldKey];
    issues.push({
      severity: 'error',
      field: fieldKey,
      message: `${entityType} "${raw}" was not found. Match an existing one, create it, leave blank, or skip the row.`,
    });
  };

  handle('locationId', 'location', catalog.entities.locations || [], '__createLocation');
  handle('departmentId', 'department', catalog.entities.departments || [], '__createDepartment');
  handle('groupId', 'group', catalog.entities.groups || [], '__createGroup');
  handle('vendorId', 'partner', catalog.entities.partners || [], '__createPartner');
  if (resolved.partnerId && !resolved.vendorId) resolved.vendorId = resolved.partnerId;
  handle('assignedTo', 'user', catalog.entities.users || [], '__createUser');

  return { resolved, issues, skipRow };
}

export async function validateImportJob({ job, rows, catalog }) {
  const fieldByKey = new Map((catalog.destinationFields || []).map((f) => [f.key, f]));
  const transforms = mapToObject(job.transforms);
  const valueMappings = mapToObject(job.valueMappings);
  const relationshipRules = mapToObject(job.relationshipRules);
  const mappings = job.columnMappings || [];

  const requiredFields = (catalog.destinationFields || []).filter((f) => f.required).map((f) => f.key);
  const assetIdsInFile = new Map(); // assetId -> first rowIndex

  const existingIds = new Set(
    (
      await Asset.find({ organizationId: job.organizationId })
        .select('assetId')
        .lean()
    ).map((a) => String(a.assetId).toLowerCase())
  );

  // Pre-allocate unique IMP-#### ids continuing past any already in the DB
  const blankIdCount = rows.reduce((n, row) => {
    const mappedProbe = mapRawRow(row.raw, mappings, fieldByKey, transforms, valueMappings);
    const id = mappedProbe.assetId != null ? String(mappedProbe.assetId).trim() : '';
    return id ? n : n + 1;
  }, 0);
  const reserved = new Set(existingIds);
  const autoIds = await allocateImportAssetIds(blankIdCount, reserved);
  let autoIdCursor = 0;

  let valid = 0;
  let warnings = 0;
  let errors = 0;
  const updatedRows = [];

  for (const row of rows) {
    const issues = [];
    let mapped = mapRawRow(row.raw, mappings, fieldByKey, transforms, valueMappings);

    // Do not force job fallback template as category — that made every row "Air Conditioner"
    // Category comes from mapped column / value mapping, or stays empty until execute.

    const rel = resolveRelationships(mapped, catalog, relationshipRules);
    mapped = rel.resolved;
    issues.push(...rel.issues);

    // Hard-required for import: name. Asset ID can be auto-generated.
    // Other template "required" fields are warnings so CSV imports aren't blocked.
    const HARD_REQUIRED = new Set(['name']);
    for (const key of requiredFields) {
      const val = mapped[key];
      if (val === undefined || val === null || val === '' || (Array.isArray(val) && !val.length)) {
        const label = fieldByKey.get(key)?.label || key;
        if (HARD_REQUIRED.has(key)) {
          issues.push({ severity: 'error', field: key, message: `${label} is required.` });
        } else if (key !== 'assetId') {
          issues.push({
            severity: 'warning',
            field: key,
            message: `${label} is empty (required on template — asset will still import).`,
          });
        }
      }
    }

    // Asset ID — mint a globally unique IMP-#### when missing
    let assetId = mapped.assetId != null ? String(mapped.assetId).trim() : '';
    if (!assetId) {
      assetId = autoIds[autoIdCursor] || `IMP-${Date.now()}-${autoIdCursor}`;
      autoIdCursor += 1;
      mapped.assetId = assetId;
      issues.push({
        severity: 'warning',
        field: 'assetId',
        message: `Asset ID missing — assigned unique ID ${assetId}.`,
      });
    }
    if (assetId) {
      const lower = assetId.toLowerCase();
      if (assetIdsInFile.has(lower)) {
        issues.push({
          severity: 'error',
          field: 'assetId',
          message: `Duplicate Asset ID in file (also on row ${assetIdsInFile.get(lower) + 1}).`,
        });
      } else {
        assetIdsInFile.set(lower, row.rowIndex);
      }

      if (existingIds.has(lower)) {
        const handling = job.duplicateHandling || 'skip';
        if (handling === 'stop') {
          issues.push({
            severity: 'error',
            field: 'assetId',
            message: `Asset ID already exists. Import is set to stop on duplicates.`,
          });
        } else if (handling === 'skip') {
          issues.push({
            severity: 'warning',
            field: 'assetId',
            message: `Asset ID already exists — this row will be skipped.`,
          });
        } else if (handling === 'update') {
          issues.push({
            severity: 'warning',
            field: 'assetId',
            message: `Asset ID already exists — existing asset will be updated.`,
          });
        } else {
          issues.push({
            severity: 'warning',
            field: 'assetId',
            message: `Asset ID already exists — a new ID may be needed or import-as-new will conflict.`,
          });
        }
      }
    }

    // Types
    for (const [key, val] of Object.entries(mapped)) {
      if (key.startsWith('__') || key.endsWith('__label')) continue;
      const def = fieldByKey.get(key);
      if (!def || val === '' || val == null) continue;
      if (def.type === 'number' || key === 'cost') {
        if (typeof val === 'number' && Number.isNaN(val)) {
          if (key === 'cost') {
            delete mapped[key];
            issues.push({
              severity: 'warning',
              field: key,
              message: `Could not read a number from "${val}" for cost — left blank.`,
            });
          } else {
            issues.push({ severity: 'error', field: key, message: `Invalid number for ${def.label}.` });
          }
        } else if (typeof val !== 'number') {
          const n = parseNumber(val);
          if (n == null || Number.isNaN(n)) {
            if (key === 'cost') {
              delete mapped[key];
              issues.push({
                severity: 'warning',
                field: key,
                message: `Could not read a number from "${val}" for cost — left blank.`,
              });
            } else {
              issues.push({ severity: 'error', field: key, message: `Invalid number for ${def.label}.` });
            }
          } else {
            mapped[key] = n;
          }
        }
      }
      if (def.type === 'date' || /date|expiry/i.test(key)) {
        if (!(val instanceof Date)) {
          const d = parseDate(val, transforms[key]?.dateFormat);
          if (!d) {
            issues.push({ severity: 'error', field: key, message: `Invalid date for ${def.label}.` });
          } else {
            mapped[key] = d;
          }
        }
      }
      if ((def.type === 'status' || key === 'status') && def.options?.length) {
        const matched = def.options.find(
          (o) => String(o) === String(val) || String(o).toLowerCase() === String(val).toLowerCase()
        );
        if (matched != null) {
          mapped[key] = matched;
        } else if (val !== '') {
          issues.push({
            severity: 'warning',
            field: key,
            message: `Unrecognized status "${val}" — will keep as-is or default on import.`,
          });
        }
      }
      // Relationship fields hold ObjectIds after resolve — never validate against option lists
      if (def.relationship || ['locationId', 'departmentId', 'vendorId', 'partnerId', 'assignedTo', 'groupId'].includes(key)) {
        continue;
      }
      // Condition must always be a valid Asset enum (even if options missing on catalog field)
      if (key === 'condition' && val !== '' && val != null) {
        const suggested = suggestConditionValue(val, ASSET_CONDITION_VALUES);
        if (suggested) {
          if (String(suggested).toLowerCase() !== String(val).toLowerCase()) {
            issues.push({
              severity: 'warning',
              field: key,
              message: `Condition "${val}" mapped to "${suggested}".`,
            });
          }
          mapped[key] = suggested;
        } else {
          mapped[key] = 'good';
          issues.push({
            severity: 'warning',
            field: key,
            message: `Unrecognized condition "${val}" — set to good.`,
          });
        }
        continue;
      }
      if ((def.type === 'select' || def.type === 'radio' || key === 'category') && def.options?.length) {
        const matched = def.options.find(
          (o) => String(o) === String(val) || String(o).toLowerCase() === String(val).toLowerCase()
        );
        if (matched != null) {
          mapped[key] = matched;
        } else if (key === 'category') {
          // New category → new asset template will be created on import
          issues.push({
            severity: 'warning',
            field: key,
            message: `New category "${val}" — an asset template will be created (assign a group later under Asset templates).`,
          });
        } else {
          issues.push({
            severity: 'warning',
            field: key,
            message: `Unrecognized value "${val}" for ${def.label} — will keep as-is.`,
          });
        }
      }
    }

    if (rel.skipRow && !issues.some((i) => i.severity === 'error')) {
      issues.push({ severity: 'error', field: '', message: 'Row skipped due to relationship rule.' });
    }

    const hasError = issues.some((i) => i.severity === 'error');
    const hasWarning = issues.some((i) => i.severity === 'warning');
    let status = 'valid';
    if (hasError) {
      status = 'error';
      errors += 1;
    } else if (hasWarning) {
      status = 'warning';
      warnings += 1;
      valid += 1;
    } else {
      valid += 1;
    }

    // Serialize dates for storage
    const mappedOut = { ...mapped };
    for (const [k, v] of Object.entries(mappedOut)) {
      if (v instanceof Date) mappedOut[k] = v.toISOString();
    }

    updatedRows.push({
      _id: row._id,
      rowIndex: row.rowIndex,
      mapped: mappedOut,
      status,
      issues,
    });
  }

  return {
    summary: { valid, warnings, errors },
    rows: updatedRows,
  };
}
