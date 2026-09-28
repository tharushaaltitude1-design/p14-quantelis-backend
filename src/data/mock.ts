export type Status = 'Completed' | 'Processing' | 'Needs review' | 'Failed';

export type DatasetStatus = 'Validated' | 'Needs review' | 'Processing';

export type DatasetColumn = { name: string; type: 'Numeric' | 'Categorical' | 'Date' };

export type Dataset = {
  id: string;
  name: string;
  source: string;
  rows: string;
  variables: number;
  updated: string;
  status: DatasetStatus;
  quality: number;
  columns: DatasetColumn[];
};

export type ProjectStatus = 'Active' | 'Draft' | 'Completed' | 'Archived';

export type Project = {
  id: string;
  name: string;
  dataset: string;
  variable: string;
  horizon: string;
  lastRun: string;
  status: ProjectStatus;
  runs: number;
  confidence: number;
};

export type Scenario = {
  id: string;
  name: string;
  project: string;
  params: string;
  objective: string;
  score: number;
};

export type ActivityEntry = {
  id: string;
  title: string;
  detail: string;
  type: 'forecast' | 'dataset' | 'scenario' | 'team' | 'security';
  time: string;
  status: Status;
  ref: string;
};

export type NotificationItem = {
  id: string;
  title: string;
  text: string;
  time: string;
  to: string;
  read: boolean;
};

export type WorkspaceRole = 'Admin' | 'Analyst' | 'Viewer';

export type TeamMember = {
  id: string;
  name: string;
  jobTitle: string;
  role: WorkspaceRole;
  invited: boolean;
};

export type Session = { id: string; device: string; location: string; lastActive: string; current: boolean };

export type WorkspaceSettings = {
  name: string;
  timezone: string;
  currency: string;
  notifications: Record<string, boolean>;
  revealApiKey: boolean;
  marketFeedConnected: boolean;
  plan: string;
};

/**
 * `photoURL` is populated from the signed-in Firebase account — a Google sign-in carries the
 * account avatar, and an uploaded photo replaces it — so every surface can show the same
 * picture instead of initials only.
 */
export type ProfileDetails = { fullName: string; email: string; jobRole: string; department: string; initials: string; photoURL: string | null };

export type SecurityState = { twoFactorEnabled: boolean };

export const DATASET_STATUSES: DatasetStatus[] = ['Validated', 'Needs review', 'Processing'];
export const PROJECT_STATUSES: ProjectStatus[] = ['Active', 'Draft', 'Completed', 'Archived'];
export const WORKSPACE_ROLES: WorkspaceRole[] = ['Admin', 'Analyst', 'Viewer'];

export const TIMEZONES = ['Eastern Time (ET)', 'Central Time (CT)', 'Mountain Time (MT)', 'Pacific Time (PT)', 'UTC'];
export const CURRENCIES = ['USD — US Dollar', 'EUR — Euro', 'GBP — Pound Sterling', 'LKR — Sri Lankan Rupee'];
export const JOB_ROLES = ['Financial Analyst', 'Supply Chain Planner', 'Energy Analyst', 'Operations Manager'];
export const HORIZONS = ['Next 6 weeks', 'Next 12 weeks', 'Next 30 days', 'Next 6 months', 'Next 12 months'];
export const OBJECTIVES = ['Maximize accuracy', 'Maximize output', 'Minimize cost', 'Minimize risk'];
export const OPERATORS = ['Current pricing', 'Promotional uplift', 'Capacity reserve', 'Safety stock change'];

export const datasets: Dataset[] = [
  {
    id: 'd1', name: 'Q3 Regional Demand — East Zone', source: 'ERP upload', rows: '184,220', variables: 18, updated: 'Today, 09:42', status: 'Validated', quality: 98.4,
    columns: [
      { name: 'date', type: 'Date' }, { name: 'region', type: 'Categorical' }, { name: 'units_sold', type: 'Numeric' },
      { name: 'avg_price', type: 'Numeric' }, { name: 'promotion_flag', type: 'Categorical' },
    ],
  },
  {
    id: 'd2', name: 'Grid Load Historicals 2023–2025', source: 'Energy API', rows: '92,480', variables: 12, updated: 'Yesterday', status: 'Validated', quality: 96.1,
    columns: [
      { name: 'timestamp', type: 'Date' }, { name: 'load_mw', type: 'Numeric' }, { name: 'temperature_c', type: 'Numeric' },
      { name: 'holiday_flag', type: 'Categorical' },
    ],
  },
  {
    id: 'd3', name: 'Raw Materials Cost Index', source: 'CSV upload', rows: '12,044', variables: 8, updated: 'Sep 18, 2025', status: 'Needs review', quality: 74.8,
    columns: [
      { name: 'month', type: 'Date' }, { name: 'cost_usd', type: 'Numeric' }, { name: 'supplier_region', type: 'Categorical' },
    ],
  },
  {
    id: 'd4', name: 'North America Inventory Signals', source: 'Snowflake', rows: '321,890', variables: 24, updated: 'Sep 17, 2025', status: 'Validated', quality: 99.1,
    columns: [
      { name: 'sku', type: 'Categorical' }, { name: 'safety_stock', type: 'Numeric' }, { name: 'lead_time_days', type: 'Numeric' },
      { name: 'warehouse', type: 'Categorical' },
    ],
  },
  {
    id: 'd5', name: 'Wholesale Price Curves', source: 'CSV upload', rows: '48,212', variables: 7, updated: 'Sep 15, 2025', status: 'Processing', quality: 88.2,
    columns: [
      { name: 'week', type: 'Date' }, { name: 'wholesale_price', type: 'Numeric' }, { name: 'tier', type: 'Categorical' },
    ],
  },
  {
    id: 'd6', name: 'Product Mix & Channel Data', source: 'ERP upload', rows: '76,032', variables: 15, updated: 'Sep 12, 2025', status: 'Validated', quality: 95.7,
    columns: [
      { name: 'period', type: 'Date' }, { name: 'channel', type: 'Categorical' }, { name: 'revenue_usd', type: 'Numeric' },
      { name: 'units', type: 'Numeric' },
    ],
  },
];

export const projects: Project[] = [
  { id: 'p1', name: 'East Coast Demand Plan', dataset: 'Q3 Regional Demand — East Zone', variable: 'units_sold', horizon: 'Next 12 weeks', lastRun: 'Today, 08:16', status: 'Active', runs: 42, confidence: 93.2 },
  { id: 'p2', name: 'Grid Load Peak Forecast', dataset: 'Grid Load Historicals 2023–2025', variable: 'load_mw', horizon: 'Next 30 days', lastRun: 'Yesterday', status: 'Active', runs: 31, confidence: 90.8 },
  { id: 'p3', name: 'Material Cost Outlook', dataset: 'Raw Materials Cost Index', variable: 'cost_usd', horizon: 'Next 6 months', lastRun: 'Sep 18, 2025', status: 'Draft', runs: 8, confidence: 86.4 },
  { id: 'p4', name: 'Inventory Replenishment', dataset: 'North America Inventory Signals', variable: 'safety_stock', horizon: 'Next 6 weeks', lastRun: 'Sep 16, 2025', status: 'Completed', runs: 27, confidence: 95.1 },
];

export const scenarios: Scenario[] = [
  { id: 's1', name: 'Base case', project: 'East Coast Demand Plan', params: 'Current pricing · 92% service level', objective: 'Maximize accuracy', score: 94 },
  { id: 's2', name: 'Promo acceleration', project: 'East Coast Demand Plan', params: '+12% marketing spend · 95% service level', objective: 'Maximize output', score: 88 },
  { id: 's3', name: 'Lean inventory', project: 'Inventory Replenishment', params: '−8% safety stock · 90% service level', objective: 'Minimize cost', score: 82 },
  { id: 's4', name: 'Peak protection', project: 'Grid Load Peak Forecast', params: '+5% reserve capacity · 99.5% uptime', objective: 'Maximize output', score: 77 },
];

export const activity: ActivityEntry[] = [
  { id: 'a1', title: 'East Coast Demand Plan', detail: 'Forecast run completed', type: 'forecast', time: '18 min ago', status: 'Completed', ref: 'RUN-8F21-0C4' },
  { id: 'a2', title: 'Raw Materials Cost Index', detail: 'Validation needs attention', type: 'dataset', time: '2 hours ago', status: 'Needs review', ref: 'RUN-7D14-9A7' },
  { id: 'a3', title: 'Promo acceleration', detail: 'Scenario comparison ready', type: 'scenario', time: 'Yesterday', status: 'Completed', ref: 'RUN-6B02-1E5' },
  { id: 'a4', title: 'Grid Load Peak Forecast', detail: 'Forecast is processing', type: 'forecast', time: 'Yesterday', status: 'Processing', ref: 'RUN-5A93-77C' },
  { id: 'a5', title: 'Q3 Regional Demand — East Zone', detail: 'Dataset uploaded', type: 'dataset', time: 'Sep 18, 2025', status: 'Completed', ref: 'RUN-49F0-3B2' },
];

export const notifications: NotificationItem[] = [
  { id: 'n1', title: 'Forecast completed', text: 'East Coast Demand Plan is ready to review.', time: '18 min ago', to: '/projects', read: false },
  { id: 'n2', title: 'Validation attention', text: 'Raw Materials Cost Index needs review.', time: '2 hours ago', to: '/datasets', read: false },
  { id: 'n3', title: 'Scenario ready', text: 'Your comparison has finished processing.', time: 'Yesterday', to: '/scenarios', read: false },
];

export const team: TeamMember[] = [
  { id: 'u1', name: 'Jordan Mitchell', jobTitle: 'Financial Analyst', role: 'Admin', invited: false },
  { id: 'u2', name: 'Maya Chen', jobTitle: 'Demand Planner', role: 'Analyst', invited: false },
  { id: 'u3', name: 'Rafael Torres', jobTitle: 'Operations Manager', role: 'Viewer', invited: true },
];

export const sessions: Session[] = [
  { id: 'sess1', device: 'Chrome on macOS', location: 'New York, US', lastActive: 'This device', current: true },
  { id: 'sess2', device: 'Safari on iPhone', location: 'New York, US', lastActive: 'Active 2 hours ago', current: false },
];

export const settings: WorkspaceSettings = {
  name: 'Quantelis Labs',
  timezone: TIMEZONES[0],
  currency: CURRENCIES[0],
  notifications: {
    'Email me when a forecast run completes': true,
    'Notify on dataset validation errors': true,
    'Weekly workspace summary': true,
    'Scenario comparison ready': false,
  },
  revealApiKey: false,
  marketFeedConnected: false,
  plan: 'Team',
};

export const profile: ProfileDetails = {
  fullName: 'Jordan Mitchell',
  email: 'jordan@quantelis.ai',
  jobRole: JOB_ROLES[0],
  department: 'Strategic Planning',
  initials: 'JM',
  photoURL: null,
};

export const security: SecurityState = { twoFactorEnabled: false };

/** Series for the runs-over-time chart. Kept as a time series because it is not a list. */
export const runData = [
  { month: 'May', runs: 24 }, { month: 'Jun', runs: 38 }, { month: 'Jul', runs: 31 }, { month: 'Aug', runs: 52 }, { month: 'Sep', runs: 68 }, { month: 'Oct', runs: 74 },
];
