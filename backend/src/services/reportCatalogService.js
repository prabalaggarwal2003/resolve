import { AssetTemplate, BudgetOrgConfig, BusinessPartnerOrgConfig } from '../models/index.js';
import {
  BUILTIN_FIELDS,
  REPORT_DATA_SOURCES,
  REPORT_OPERATORS,
  REPORT_CALCULATION_TYPES,
  REPORT_VISUALIZATIONS,
  REPORT_EXPORT_FORMATS,
  SYSTEM_QUICK_REPORTS,
  DEFAULT_REPORT_FORMATTING,
} from '../constants/reportStudioDefaults.js';

function mapTemplateField(field, source) {
  const typeMap = {
    text: 'string',
    textarea: 'string',
    number: 'number',
    currency: 'number',
    date: 'date',
    select: 'select',
    multiselect: 'select',
    boolean: 'boolean',
    checkbox: 'boolean',
  };
  return {
    key: `custom.${field.key}`,
    label: field.label || field.key,
    type: typeMap[field.type] || 'string',
    custom: true,
    source,
    groupable: true,
    aggregatable: field.type === 'number' || field.type === 'currency',
    options: field.options || [],
  };
}

export async function getReportCatalog(organizationId) {
  const [templates, budgetConfig, partnerConfig] = await Promise.all([
    AssetTemplate.find({ organizationId }).select('name fields').lean(),
    BudgetOrgConfig.findOne({ organizationId }).lean(),
    BusinessPartnerOrgConfig.findOne({ organizationId }).lean(),
  ]);

  const assetCustom = [];
  const seen = new Set();
  for (const tpl of templates) {
    for (const field of tpl.fields || []) {
      if (!field?.key || field.builtIn) continue;
      if (seen.has(field.key)) continue;
      seen.add(field.key);
      assetCustom.push(mapTemplateField(field, 'assets'));
    }
  }

  const budgetCustom = (budgetConfig?.customFields || []).map((f) => mapTemplateField(f, 'budgets'));
  const procurementCustom = (budgetConfig?.procurementCustomFields || []).map((f) =>
    mapTemplateField(f, 'procurement')
  );
  const partnerCustom = (partnerConfig?.customFields || []).map((f) => mapTemplateField(f, 'partners'));

  const sources = REPORT_DATA_SOURCES.map((src) => {
    const builtin = (BUILTIN_FIELDS[src.key] || []).map((f) => ({
      ...f,
      source: src.key,
      custom: false,
    }));
    let custom = [];
    if (src.key === 'assets') custom = assetCustom;
    if (src.key === 'budgets') custom = budgetCustom;
    if (src.key === 'procurement') custom = procurementCustom;
    if (src.key === 'partners' || src.key === 'vendors') custom = partnerCustom.map((f) => ({ ...f, source: src.key }));
    return {
      ...src,
      fields: [...builtin, ...custom],
    };
  });

  return {
    sources,
    operators: REPORT_OPERATORS,
    calculations: REPORT_CALCULATION_TYPES,
    visualizations: REPORT_VISUALIZATIONS,
    exportFormats: REPORT_EXPORT_FORMATS,
    defaultFormatting: DEFAULT_REPORT_FORMATTING,
    quickReports: SYSTEM_QUICK_REPORTS.map((q) => ({
      key: q.key,
      name: q.name,
      category: q.category,
      description: q.description,
    })),
  };
}

export function getQuickReportPreset(key) {
  return SYSTEM_QUICK_REPORTS.find((q) => q.key === key) || null;
}

export function listQuickReportPresets() {
  return SYSTEM_QUICK_REPORTS;
}
