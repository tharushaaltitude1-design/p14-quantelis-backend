export type PlanName = 'Individual' | 'Team' | 'Usage-based' | 'Enterprise';

export const PLANS: { name: PlanName; blurb: string; price: string }[] = [
  { name: 'Individual', blurb: 'For focused analysts', price: '$49 / month' },
  { name: 'Team', blurb: 'For growing teams', price: '$149 / month' },
  { name: 'Usage-based', blurb: 'For variable workloads', price: 'Pay per run' },
  { name: 'Enterprise', blurb: 'For complex organizations', price: 'Contact sales' },
];

export const USAGE_BREAKDOWN = [
  { label: 'Forecast runs', used: 1_284, limit: 2_000, unit: 'runs' },
  { label: 'Compute minutes', used: 3_410, limit: 5_000, unit: 'min' },
  { label: 'Team seats', used: 3, limit: 5, unit: 'seats' },
];

export const INVOICES = [
  { id: 'INV-2025-10', date: 'Oct 1, 2025', amount: '$149.00', status: 'Paid' },
  { id: 'INV-2025-09', date: 'Sep 1, 2025', amount: '$149.00', status: 'Paid' },
  { id: 'INV-2025-08', date: 'Aug 1, 2025', amount: '$126.65', status: 'Paid' },
];

export const API_KEY_MASKED = 'qls_live_••••••••••••8f21';
export const API_KEY_PLAIN = 'qls_live_k3m9x7p2qv8rd4wf6zh1b0n5c7t2y9js8f21';
