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
  /** Step 1 of the reset flow: ask for the address and email a link. */
  forgotPassword: '/forgot-password',
  /** Step 2: the emailed link lands here with an `oobCode` that sets the new password. */
  resetPassword: '/reset-password',
} as const;

/**
 * Guest-only screens. A signed-in visitor bouncing off any of these should land on the
 * dashboard rather than being sent back to a sign-in form, and a deep link that captured one of
 * them as its return target must not become the destination after sign-in.
 */
export const GUEST_ROUTES: readonly string[] = [ROUTES.login, ROUTES.signup, ROUTES.forgotPassword, ROUTES.resetPassword];

export const ROLES = ['Admin', 'Analyst', 'Viewer'] as const;
export const PAGE_SIZE = 8;
export const MAX_UPLOAD_BYTES = 250 * 1024 * 1024;
export const MAX_COMPARE_SCENARIOS = 4;
