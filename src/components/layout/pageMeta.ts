export type PageMeta = { title: string; subtitle: string };

const META: Array<[prefix: string, meta: PageMeta]> = [
  ['/datasets', { title: 'Datasets', subtitle: 'Manage the data behind your forecasts' }],
  ['/projects', { title: 'Forecasting projects', subtitle: 'Build, run, and monitor your operational models' }],
  ['/scenarios', { title: 'Scenarios & optimization', subtitle: 'Compare alternatives and find your best outcome' }],
  ['/history', { title: 'Results & history', subtitle: 'A complete record of your analytical work' }],
  ['/settings', { title: 'Settings', subtitle: 'Configure your workspace and team preferences' }],
  ['/security', { title: 'Security', subtitle: 'Keep your account and workspace protected' }],
  ['/profile', { title: 'Your profile', subtitle: 'Manage your personal workspace details' }],
];

export function pageMeta(pathname: string): PageMeta {
  if (pathname === '/') return { title: 'Overview', subtitle: 'Your forecasting activity at a glance' };
  const match = META.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  return match ? match[1] : { title: 'Page not found', subtitle: 'We could not find what you were looking for' };
}
