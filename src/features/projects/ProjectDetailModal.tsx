import { Activity, BarChart3, Database, Gauge, Play } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { useWorkspace, useWorkspaceDispatch } from '@/state/workspaceContext';
import type { Project } from '@/data/mock';

type ProjectDetailModalProps = { project: Project; onClose: () => void };

export function ProjectDetailModal({ project, onClose }: ProjectDetailModalProps) {
  const { activity, scenarios } = useWorkspace();
  const dispatch = useWorkspaceDispatch();
  const related = activity.filter((entry) => entry.title === project.name).slice(0, 4);
  const relatedScenarios = scenarios.filter((scenario) => scenario.project === project.name);

  return (
    <Modal title={project.name} onClose={onClose}>
      <div className="detail-overview">
        <span className="file-icon large">
          <BarChart3 size={20} />
        </span>
        <div>
          <span className={`project-status status-${project.status.toLowerCase()}`}>
            <i />
            {project.status}
          </span>
          <p>
            {project.dataset} · last run {project.lastRun.toLowerCase()}
          </p>
        </div>
      </div>
      <div className="detail-stats">
        <div>
          <span>Runs</span>
          <b>{project.runs}</b>
        </div>
        <div>
          <span>Accuracy</span>
          <b>{project.confidence.toFixed(1)}%</b>
        </div>
        <div>
          <span>Scenarios</span>
          <b>{relatedScenarios.length}</b>
        </div>
      </div>
      <h3 className="section-label">Configuration</h3>
      {[
        ['Dataset', project.dataset, Database],
        ['Forecast variable', project.variable, BarChart3],
        ['Horizon', project.horizon, Activity],
        ['Accuracy trend', project.confidence >= 90 ? 'Improving' : 'Watch', Gauge],
      ].map(([label, value, Icon]) => {
        const RowIcon = Icon as typeof Database;
        return (
          <div className="variable-row" key={String(label)}>
            <code>
              <RowIcon size={13} aria-hidden="true" /> {String(value)}
            </code>
            <span>{String(label)}</span>
          </div>
        );
      })}
      {related.length > 0 && (
        <>
          <h3 className="section-label">Recent activity</h3>
          {related.map((entry) => (
            <div className="variable-row" key={entry.id}>
              <code>{entry.detail}</code>
              <span>{entry.time}</span>
            </div>
          ))}
        </>
      )}
      <div className="modal-actions">
        <button type="button" className="secondary-button" onClick={onClose}>
          Close
        </button>
        <button
          type="button"
          className="primary-button"
          onClick={() => {
            dispatch({ type: 'project/recordRun', id: project.id, runs: project.runs + 1, confidence: project.confidence });
            dispatch({ type: 'toast/push', toast: { kind: 'success', title: 'Forecast re-run', message: `${project.name} completed.` } });
            onClose();
          }}
        >
          <Play size={16} /> Run forecast
        </button>
      </div>
    </Modal>
  );
}
