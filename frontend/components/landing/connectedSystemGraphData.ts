export type GraphTooltip = {
  title: string;
  subtitle: string;
};

export type GraphNodeDef = {
  id: string;
  label: string;
  /** Normalized layout coords (-1..1-ish), desktop */
  x: number;
  y: number;
  /** Optional mobile overrides; omit to hide on mobile */
  mobileX?: number;
  mobileY?: number;
  mobile?: boolean;
  /** Reveal wave: 0 = always (Resolve), higher = later in scroll */
  stage: number;
  tooltip: GraphTooltip;
  /** Hub node styling */
  hub?: boolean;
};

export type GraphEdgeDef = {
  id: string;
  from: string;
  to: string;
  stage: number;
  /** Carry a subtle data particle */
  particle?: boolean;
};

/** Desktop + mobile graph for the Connected System visualization */
export const CONNECTED_SYSTEM_NODES: GraphNodeDef[] = [
  {
    id: 'resolve',
    label: 'Resolve',
    x: 0,
    y: 0,
    mobileX: 0,
    mobileY: 0,
    mobile: true,
    stage: 0,
    hub: true,
    tooltip: {
      title: 'Resolve',
      subtitle: 'One connected operations system',
    },
  },
  {
    id: 'asset',
    label: 'Asset',
    x: 1.35,
    y: 0.05,
    mobileX: 0.95,
    mobileY: 0.15,
    mobile: true,
    stage: 1,
    tooltip: {
      title: 'CNC Machine #104',
      subtitle: 'Operational',
    },
  },
  {
    id: 'partner',
    label: 'Partner',
    x: -0.15,
    y: -1.15,
    mobileX: -0.9,
    mobileY: -0.55,
    mobile: true,
    stage: 2,
    tooltip: {
      title: 'ABC Industrial',
      subtitle: 'Supplier',
    },
  },
  {
    id: 'location',
    label: 'Location',
    x: 0.95,
    y: 0.95,
    mobileX: 0.85,
    mobileY: 0.85,
    mobile: true,
    stage: 2,
    tooltip: {
      title: 'Plant B · Bay 3',
      subtitle: 'Floor plan mapped',
    },
  },
  {
    id: 'maintenance',
    label: 'Maintenance',
    x: -1.05,
    y: 0.75,
    mobileX: -0.75,
    mobileY: 0.75,
    mobile: true,
    stage: 2,
    tooltip: {
      title: 'Quarterly service',
      subtitle: 'Completed 12 days ago',
    },
  },
  {
    id: 'invoice',
    label: 'Invoice',
    x: -1.35,
    y: -0.15,
    mobileX: -0.95,
    mobileY: 0.1,
    mobile: true,
    stage: 3,
    tooltip: {
      title: 'INV-20491',
      subtitle: 'Paid · linked to purchase',
    },
  },
  {
    id: 'contract',
    label: 'Contract',
    x: -0.85,
    y: -1.05,
    stage: 3,
    tooltip: {
      title: 'AMC · 2025–26',
      subtitle: 'Active agreement',
    },
  },
  {
    id: 'user',
    label: 'User',
    x: 1.45,
    y: -0.75,
    stage: 3,
    tooltip: {
      title: 'Rahul Sharma',
      subtitle: 'Assigned custodian',
    },
  },
  {
    id: 'issue',
    label: 'Issue',
    x: -1.35,
    y: 1.15,
    mobileX: 0,
    mobileY: 1.15,
    mobile: true,
    stage: 3,
    tooltip: {
      title: 'Hydraulic pressure issue',
      subtitle: 'Resolved',
    },
  },
  {
    id: 'audit',
    label: 'Audit',
    x: 0.35,
    y: 1.25,
    stage: 3,
    tooltip: {
      title: 'Q1 physical count',
      subtitle: 'Verified on site',
    },
  },
  {
    id: 'resolution',
    label: 'Resolution',
    x: -0.55,
    y: 1.35,
    stage: 3,
    tooltip: {
      title: 'Seal replaced',
      subtitle: 'Closed with notes',
    },
  },
];

export const CONNECTED_SYSTEM_EDGES: GraphEdgeDef[] = [
  { id: 'e-resolve-asset', from: 'resolve', to: 'asset', stage: 1, particle: true },
  { id: 'e-resolve-partner', from: 'resolve', to: 'partner', stage: 2, particle: true },
  { id: 'e-resolve-location', from: 'resolve', to: 'location', stage: 2 },
  { id: 'e-resolve-maintenance', from: 'resolve', to: 'maintenance', stage: 2, particle: true },
  { id: 'e-partner-contract', from: 'partner', to: 'contract', stage: 3 },
  { id: 'e-partner-invoice', from: 'partner', to: 'invoice', stage: 3, particle: true },
  { id: 'e-invoice-asset', from: 'invoice', to: 'asset', stage: 3, particle: true },
  { id: 'e-asset-location', from: 'asset', to: 'location', stage: 3 },
  { id: 'e-asset-user', from: 'asset', to: 'user', stage: 3 },
  { id: 'e-asset-maintenance', from: 'asset', to: 'maintenance', stage: 3, particle: true },
  { id: 'e-asset-audit', from: 'asset', to: 'audit', stage: 3 },
  { id: 'e-maintenance-issue', from: 'maintenance', to: 'issue', stage: 3, particle: true },
  { id: 'e-issue-resolution', from: 'issue', to: 'resolution', stage: 3 },
];

export const GRAPH_STAGE_COUNT = 4; // stages 0..3
