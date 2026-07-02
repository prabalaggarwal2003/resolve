export const DEFAULT_ASSET_GROUPS = [
  { key: 'it', name: 'IT', order: 0 },
  { key: 'infra', name: 'Infra', order: 1 },
  { key: 'consumables', name: 'Consumables', order: 2 },
];

/** Default template name → group key when seeding */
export const DEFAULT_TEMPLATE_GROUP_MAP = {
  Laptop: 'it',
  Desktop: 'it',
  Router: 'it',
  Printer: 'consumables',
  Projector: 'infra',
  Vehicle: 'infra',
  Furniture: 'infra',
  'Air Conditioner': 'infra',
};
