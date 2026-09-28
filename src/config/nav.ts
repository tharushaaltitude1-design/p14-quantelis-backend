import { BarChart3, Database, FileClock, LayoutDashboard, Settings, ShieldCheck, SlidersHorizontal, type LucideIcon } from 'lucide-react';
import { ROUTES } from './constants';

export type NavItem = { label: string; to: string; icon: LucideIcon; dot?: boolean };

export const NAV_PRIMARY: NavItem[] = [
  { label: 'Overview', to: ROUTES.overview, icon: LayoutDashboard },
  { label: 'Datasets', to: ROUTES.datasets, icon: Database },
  { label: 'Forecasting Projects', to: ROUTES.projects, icon: BarChart3 },
  { label: 'Scenarios & Optimization', to: ROUTES.scenarios, icon: SlidersHorizontal, dot: true },
  { label: 'Results & History', to: ROUTES.history, icon: FileClock },
];

export const NAV_GENERAL: NavItem[] = [
  { label: 'Settings', to: ROUTES.settings, icon: Settings },
  { label: 'Security', to: ROUTES.security, icon: ShieldCheck },
];
