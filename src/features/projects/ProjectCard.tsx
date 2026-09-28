import { useState } from 'react';
import { Activity, Archive, ArchiveRestore, ChevronRight, Copy, Play, Trash2 } from 'lucide-react';
import type { Project } from '@/data/mock';
import { Card } from '@/components/ui/Card';
import { Menu, type MenuEntry } from '@/components/ui/Menu';
import { useWorkspaceDispatch } from '@/state/workspaceContext';

export type ProjectAction = 'open' | 'run' | 'duplicate' | 'archive' | 'restore' | 'delete';

type ProjectCardProps = {
  project: Project;
  onAction: (action: ProjectAction, project: Project) => void;
};

export function ProjectCard({ project, onAction }: ProjectCardProps) {
  const dispatch = useWorkspaceDispatch();
  const [busy, setBusy] = useState(false);
  const archived = project.status === 'Archived';

  const run = () => {
    setBusy(true);
    window.setTimeout(() => {
      setBusy(false);
      dispatch({ type: 'project/recordRun', id: project.id, runs: project.runs + 1, confidence: project.confidence });
      dispatch({ type: 'toast/push', toast: { kind: 'success', title: 'Forecast completed', message: `${project.name} finished with ${project.confidence.toFixed(1)}% accuracy.` } });
      onAction('run', project);
    }, 900);
  };

  const entries: MenuEntry[] = [
    { id: 'open', label: 'View details', icon: ChevronRight, onSelect: () => onAction('open', project) },
    { id: 'run', label: 'Run forecast', icon: Play, onSelect: run },
    { id: 'duplicate', label: 'Duplicate', icon: Copy, onSelect: () => onAction('duplicate', project) },
    archived
      ? { id: 'restore', label: 'Restore', icon: ArchiveRestore, onSelect: () => onAction('restore', project) }
      : { id: 'archive', label: 'Archive', icon: Archive, onSelect: () => onAction('archive', project) },
    { id: 'card-separator', kind: 'separator' },
    { id: 'delete', label: 'Delete', icon: Trash2, danger: true, onSelect: () => onAction('delete', project) },
  ];

  return (
    <Card className={`project-card ${archived ? 'is-archived' : ''}`}>
      <div className="project-card-top">
        <span className={`project-status status-${project.status.toLowerCase()}`}>
          <i />
          {project.status}
        </span>
        <Menu label={`Options for ${project.name}`} entries={entries} />
      </div>
      <h2>{project.name}</h2>
      <p>{project.dataset}</p>
      <div className="project-meta">
        <span>
          <small>Forecast variable</small>
          <b>{project.variable}</b>
        </span>
        <span>
          <small>Horizon</small>
          <b>{project.horizon}</b>
        </span>
      </div>
      <div className="project-footer">
        <span>
          <Activity size={14} /> {busy ? 'Running…' : `Last run ${project.lastRun}`}
        </span>
        <button type="button" className="link-button" onClick={() => onAction('open', project)}>
          Open <ChevronRight size={14} />
        </button>
      </div>
    </Card>
  );
}
