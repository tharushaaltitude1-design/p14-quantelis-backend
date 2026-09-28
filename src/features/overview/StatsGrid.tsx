import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Database, Download, Gauge, Target, Zap } from 'lucide-react';
import { StatCard } from '@/components/ui/StatCard';
import type { MenuEntry } from '@/components/ui/Menu';
import { runData } from '@/data/mock';
import { meanAccuracy } from '@/state/workspaceReducer';
import { useWorkspace } from '@/state/workspaceContext';
import { downloadCsv } from '@/lib/csv';

type StatsGridProps = { months: number };

export function StatsGrid({ months }: StatsGridProps) {
  const state = useWorkspace();
  const navigate = useNavigate();

  const { runs, trend } = useMemo(() => {
    const window = runData.slice(-months);
    const total = window.reduce((sum, point) => sum + point.runs, 0);
    const half = Math.max(1, Math.floor(window.length / 2));
    const earlier = window.slice(0, half).reduce((sum, point) => sum + point.runs, 0);
    const recent = window.slice(half).reduce((sum, point) => sum + point.runs, 0);
    const delta = earlier === 0 ? 0 : ((recent - earlier) / earlier) * 100;
    return { runs: total, trend: { value: `${Math.abs(delta).toFixed(1)}%`, up: delta >= 0 } };
  }, [months]);

  const activeProjects = state.projects.filter((project) => project.status === 'Active').length;
  const accuracy = meanAccuracy(state);
  const period = `last ${months} months`;

  const csv = (name: string, headers: string[], rows: Array<Array<string | number>>) =>
    downloadCsv(name, headers, rows);

  const projectsMenu: MenuEntry[] = [
    { id: 'view', label: 'View all projects', icon: Target, onSelect: () => navigate('/projects') },
    { id: 'csv', label: 'Export CSV', icon: Download, onSelect: () => csv('projects.csv', ['Name', 'Dataset', 'Status'], state.projects.map((p) => [p.name, p.dataset, p.status])) },
  ];
  const runsMenu: MenuEntry[] = [
    { id: 'history', label: 'View run history', icon: Zap, onSelect: () => navigate('/history') },
    { id: 'csv', label: 'Export CSV', icon: Download, onSelect: () => csv('forecast-runs.csv', ['Month', 'Runs'], runData.slice(-months).map((p) => [p.month, p.runs])) },
  ];
  const datasetsMenu: MenuEntry[] = [
    { id: 'view', label: 'View all datasets', icon: Database, onSelect: () => navigate('/datasets') },
    { id: 'csv', label: 'Export CSV', icon: Download, onSelect: () => csv('datasets.csv', ['Name', 'Source', 'Rows', 'Status'], state.datasets.map((d) => [d.name, d.source, d.rows, d.status])) },
  ];
  const accuracyMenu: MenuEntry[] = [
    { id: 'projects', label: 'Compare across projects', icon: Gauge, onSelect: () => navigate('/projects') },
    { id: 'csv', label: 'Export CSV', icon: Download, onSelect: () => csv('accuracy.csv', ['Project', 'Accuracy', 'Runs'], state.projects.map((p) => [p.name, `${p.confidence}%`, p.runs])) },
  ];

  return (
    <section className="stats-grid">
      <StatCard label="Active projects" value={String(activeProjects)} icon={<Target size={18} />} tone="blue" menu={projectsMenu} />
      <StatCard label={`Forecast runs (${period})`} value={String(runs)} trend={trend} icon={<Zap size={18} />} tone="cyan" menu={runsMenu} />
      <StatCard label="Datasets managed" value={String(state.datasets.length)} icon={<Database size={18} />} tone="amber" menu={datasetsMenu} />
      <StatCard label="Avg. forecast accuracy" value={`${accuracy.toFixed(1)}%`} icon={<Gauge size={18} />} tone="green" menu={accuracyMenu} />
    </section>
  );
}
