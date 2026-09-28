import type { ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight, MoreHorizontal } from 'lucide-react';
import { Menu, type MenuEntry } from './Menu';

type StatCardProps = {
  label: string;
  value: string;
  /** Omitted when there is no comparable prior period, rather than inventing a number. */
  trend?: { value: string; up: boolean };
  icon: ReactNode;
  tone: 'blue' | 'cyan' | 'amber' | 'green';
  menu?: MenuEntry[];
  onOpen?: () => void;
};

export function StatCard({ label, value, trend, icon, tone, menu, onOpen }: StatCardProps) {
  return (
    <div className={`stat-card tone-${tone}`}>
      <div className="stat-top">
        <span className="stat-icon">{icon}</span>
        {onOpen ? (
          <button type="button" className="icon-button" aria-label={`View ${label.toLowerCase()} details`} onClick={onOpen}>
            <MoreHorizontal size={16} />
          </button>
        ) : menu && menu.length > 0 ? (
          <Menu label={`${label} options`} entries={menu} />
        ) : null}
      </div>
      <span className="stat-label">{label}</span>
      <strong>{value}</strong>
      {trend ? (
        <span className={`trend ${trend.up ? 'trend-up' : 'trend-down'}`}>
          {trend.up ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
          {trend.value} <small>vs last period</small>
        </span>
      ) : (
        <span className="trend trend-none">
          <small>No prior period to compare</small>
        </span>
      )}
    </div>
  );
}
