import { Select } from '@/components/ui/Select';
import { EnterpriseCallout, ProjectsByStatusCard, RecentActivityCard, RunsOverTimeCard, TopScenariosCard } from './OverviewCards';
import { StatsGrid } from './StatsGrid';
import { useState } from 'react';

const RANGES = ['Last 3 months', 'Last 6 months'];

export function OverviewPage() {
  const [range, setRange] = useState(RANGES[1]);
  const months = range === RANGES[0] ? 3 : 6;
  return (
    <div className="page-stack">
      <div className="page-toolbar">
        <div>
          <span className="live-indicator">
            <i /> Live workspace
          </span>
        </div>
        <Select value={range} onChange={setRange} options={RANGES} label="Date range" className="select-control" />
      </div>
      <StatsGrid months={months} />
      <section className="dashboard-grid top-grid">
        <ProjectsByStatusCard />
        <RunsOverTimeCard />
      </section>
      <section className="dashboard-grid bottom-grid">
        <TopScenariosCard />
        <RecentActivityCard />
        <EnterpriseCallout />
      </section>
    </div>
  );
}
