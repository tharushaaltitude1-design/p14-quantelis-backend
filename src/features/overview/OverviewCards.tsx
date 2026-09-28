import { ArrowUpRight, ChevronRight, Download, Sparkles, Table2 } from 'lucide-react';
import { runData } from '@/data/mock';
import { projectStatusCounts } from '@/state/workspaceReducer';
import { useWorkspace } from '@/state/workspaceContext';
import { AreaTrendChart } from '@/components/charts/AreaTrendChart';
import { DonutChart } from '@/components/charts/DonutChart';
import { RankingBars } from '@/components/charts/RankingBars';
import { ActivityIcon } from '@/components/ui/ActivityIcon';
import { Card, CardHeader } from '@/components/ui/Card';
import { Menu, type MenuEntry } from '@/components/ui/Menu';
import { StatusPill } from '@/components/ui/StatusPill';
import { useNavigate } from 'react-router-dom';
import { downloadCsv } from '@/lib/csv';
import { useState } from 'react';
import { RunsTableModal } from './RunsTableModal';
import { EnterpriseModal } from './EnterpriseModal';

const totalRuns = runData.reduce((sum, point) => sum + point.runs, 0);

export function ProjectsByStatusCard() {
  const state = useWorkspace();
  const data = projectStatusCounts(state).filter((slice) => slice.value > 0);
  const total = data.reduce((sum, slice) => sum + slice.value, 0);
  return (
    <Card className="chart-card donut-card">
      <CardHeader title="Projects by status" meta={`${total} total`} />
      {data.length > 0 ? <DonutChart data={data} centerLabel="Projects" /> : <p className="chart-empty">No projects yet.</p>}
    </Card>
  );
}

export function RunsOverTimeCard() {
  const [showTable, setShowTable] = useState(false);
  const exportCsv = () => {
    downloadCsv('forecast-runs.csv', ['Month', 'Runs'], runData.map((point) => [point.month, point.runs]));
  };
  const entries: MenuEntry[] = [
    { id: 'csv', label: 'Export CSV', icon: Download, onSelect: exportCsv },
    { id: 'table', label: 'View as table', icon: Table2, onSelect: () => setShowTable(true) },
  ];
  return (
    <Card className="chart-card revenue-card">
      <CardHeader
        title="Forecast runs over time"
        meta="Runs / month"
        action={<Menu label="Forecast runs chart options" entries={entries} />}
      />
      <div className="chart-legend">
        <span>
          <i className="legend-dot dot-0" />
          Forecast runs
        </span>
        <span className="muted-text">Total {totalRuns} runs</span>
      </div>
      <AreaTrendChart data={runData} xKey="month" yKey="runs" gradientId="runsFill" />
      {showTable && <RunsTableModal onClose={() => setShowTable(false)} />}
    </Card>
  );
}

export function TopScenariosCard() {
  const { scenarios } = useWorkspace();
  const navigate = useNavigate();
  const items = scenarios.slice(0, 5).map((s) => ({ id: s.id, name: s.name, sub: s.project, score: s.score }));
  return (
    <Card>
      <CardHeader
        title="Top performing scenarios"
        meta="By optimization score"
        action={
          <Menu
            label="Top scenarios options"
            trigger={(props) => (
              <button {...props} type="button" className="link-button">
                View all <ChevronRight size={14} />
              </button>
            )}
            entries={[
              { id: 'all', label: 'View all scenarios', onSelect: () => navigate('/scenarios') },
              { id: 'projects', label: 'Go to projects', onSelect: () => navigate('/projects') },
            ]}
          />
        }
      />
      {items.length > 0 ? <RankingBars items={items} /> : <p className="chart-empty">No scenarios yet.</p>}
    </Card>
  );
}

export function RecentActivityCard() {
  const { activity } = useWorkspace();
  const navigate = useNavigate();
  return (
    <Card>
      <CardHeader
        title="Recent activity"
        meta="Updated just now"
        action={
          <Menu
            label="Recent activity options"
            trigger={(props) => (
              <button {...props} type="button" className="link-button">
                View history <ChevronRight size={14} />
              </button>
            )}
            entries={[
              { id: 'history', label: 'View full history', onSelect: () => navigate('/history') },
              { id: 'datasets', label: 'Review datasets', onSelect: () => navigate('/datasets') },
            ]}
          />
        }
      />
      <div className="activity-list">
        {activity.slice(0, 6).map((item) => (
          <div className="activity-row" key={item.id}>
            <ActivityIcon type={item.type} />
            <span className="activity-copy">
              <b>{item.title}</b>
              <small>{item.detail}</small>
            </span>
            <span className="activity-time">{item.time}</span>
            <StatusPill status={item.status} />
          </div>
        ))}
      </div>
    </Card>
  );
}

export function EnterpriseCallout() {
  const [open, setOpen] = useState(false);
  return (
    <div className="upgrade-card">
      <div className="upgrade-spark">
        <Sparkles size={18} />
      </div>
      <span className="eyebrow">QUANTELIS ENTERPRISE</span>
      <h3>Move from insight to impact.</h3>
      <p>Unlock unlimited scenarios, team workspaces, and priority compute.</p>
      <button type="button" className="secondary-button" onClick={() => setOpen(true)}>
        Explore enterprise <ArrowUpRight size={15} />
      </button>
      {open && <EnterpriseModal onClose={() => setOpen(false)} />}
    </div>
  );
}
