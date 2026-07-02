/** Default policies seeded per organization */
export const DEFAULT_DEPRECIATION_POLICIES = [
  {
    name: 'Laptop Policy',
    method: 'WDV',
    rate: 40,
    yearRates: [{ year: 1, rate: 40 }, { year: 2, rate: 40 }, { year: 3, rate: 40 }],
    residualPct: 10,
    description: 'High-rate WDV for laptops',
    categoryNames: ['Laptop'],
  },
  {
    name: 'Furniture Policy',
    method: 'SLM',
    rate: 10,
    residualPct: 5,
    description: 'Straight-line for furniture',
    categoryNames: ['Furniture'],
  },
  {
    name: 'IT Assets',
    method: 'WDV',
    rate: 25,
    residualPct: 10,
    groupKey: 'it',
  },
  {
    name: 'Infrastructure',
    method: 'SLM',
    rate: 10,
    residualPct: 5,
    groupKey: 'infra',
  },
  {
    name: 'Consumables',
    method: 'WDV',
    rate: 40,
    residualPct: 5,
    groupKey: 'consumables',
  },
  {
    name: 'Organization Default',
    method: 'SLM',
    rate: 15,
    residualPct: 5,
    isOrgDefault: true,
  },
];
