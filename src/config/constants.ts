export const COMPANY = {
  name: 'Quantelis',
  siteUrl: 'https://quantelis.lk',
  productUrl: 'https://quantelis.lk/product',
  offices: [
    { name: 'Quantelis Technologies Inc.', address: '550 California Street, Suite 300, San Francisco, CA 94104, US', phone: '+1 415 555 0142' },
    { name: 'Quantelis Technologies (Pvt) Ltd', address: 'No. 42, Galle Road, Colombo 03, Sri Lanka', phone: '+94 11 555 0142' },
  ],
} as const;

export const ROUTES = {
  overview: '/',
  datasets: '/datasets',
  projects: '/projects',
  scenarios: '/scenarios',
  history: '/history',
  settings: '/settings',
  security: '/security',
  profile: '/profile',
  login: '/login',
  signup: '/signup',
} as const;

export const ROLES = ['Admin', 'Analyst', 'Viewer'] as const;
export const PAGE_SIZE = 8;
export const MAX_UPLOAD_BYTES = 250 * 1024 * 1024;
export const MAX_COMPARE_SCENARIOS = 4;
