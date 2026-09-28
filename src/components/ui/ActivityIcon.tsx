import { BarChart3, Database, ShieldCheck, SlidersHorizontal, Users } from 'lucide-react';
import type { ActivityEntry } from '@/data/mock';

const ICONS = {
  forecast: BarChart3,
  dataset: Database,
  scenario: SlidersHorizontal,
  team: Users,
  security: ShieldCheck,
} as const;

export function ActivityIcon({ type }: { type: ActivityEntry['type'] }) {
  const Icon = ICONS[type] ?? BarChart3;
  return (
    <span className={`activity-icon ${type}`}>
      <Icon size={15} />
    </span>
  );
}
