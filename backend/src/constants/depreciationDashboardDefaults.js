/** Default depreciation dashboard widgets for new users */
export const DEFAULT_DEPRECIATION_DASHBOARD = {
  version: 1,
  widgets: [
    { id: 'w1', title: 'Total depreciation', metric: 'depreciation', groupBy: null, chartType: 'kpi', filters: {}, filterFields: [], order: 0, colSpan: 4, rowSpan: 1, sizeLocked: false },
    { id: 'w2', title: 'Depreciation %', metric: 'depreciation_pct', groupBy: null, chartType: 'kpi', filters: {}, filterFields: [], order: 1, colSpan: 4, rowSpan: 1, sizeLocked: false },
    { id: 'w3', title: 'Fully depreciated assets', metric: 'fully_depreciated_count', groupBy: null, chartType: 'kpi', filters: {}, filterFields: [], order: 2, colSpan: 4, rowSpan: 1, sizeLocked: false },
    { id: 'w4', title: 'Purchase vs current value', metric: 'purchase_value', groupBy: null, chartType: 'donut', filters: {}, filterFields: [], order: 3, colSpan: 5, rowSpan: 2, sizeLocked: false },
    { id: 'w5', title: 'Depreciation by asset group', metric: 'depreciation', groupBy: 'group', chartType: 'horizontal_bar', filters: {}, filterFields: [], order: 4, colSpan: 6, rowSpan: 3, sizeLocked: false },
    { id: 'w6', title: 'Book value trend', metric: 'book_value', groupBy: 'purchase_year', chartType: 'line', filters: {}, filterFields: [], order: 5, colSpan: 6, rowSpan: 2, sizeLocked: false },
    { id: 'w7', title: 'Asset distribution by value', metric: 'book_value', groupBy: 'value_bucket', chartType: 'donut', filters: {}, filterFields: [], order: 6, colSpan: 5, rowSpan: 2, sizeLocked: false },
    { id: 'w8', title: 'Near end of useful life', metric: 'remaining_life', groupBy: 'asset', chartType: 'horizontal_bar', filters: {}, filterFields: [], order: 7, colSpan: 12, rowSpan: 4, sizeLocked: false },
  ],
};

export function getDefaultDepreciationDashboard() {
  return JSON.parse(JSON.stringify(DEFAULT_DEPRECIATION_DASHBOARD));
}
