import { useState } from 'react';
import { ChevronRight, Database, Download, Pencil, Trash2 } from 'lucide-react';
import { StatusPill } from '@/components/ui/StatusPill';
import { Modal } from '@/components/ui/Modal';
import { Menu, type MenuEntry } from '@/components/ui/Menu';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { PromptDialog } from '@/components/ui/PromptDialog';
import { useWorkspaceDispatch } from '@/state/workspaceContext';
import { downloadCsv } from '@/lib/csv';
import type { Dataset } from '@/data/mock';

type DatasetDetailModalProps = { dataset: Dataset; onClose: () => void };

export function DatasetDetailModal({ dataset, onClose }: DatasetDetailModalProps) {
  const dispatch = useWorkspaceDispatch();
  const [tab, setTab] = useState<'variables' | 'quality'>('variables');
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const exportRows = () => {
    downloadCsv(`${dataset.id}-metadata.csv`, ['Column', 'Type', 'Filled', 'Missing'], dataset.columns.map((column) => [column.name, column.type, '—', '—']));
    dispatch({ type: 'toast/push', toast: { kind: 'success', title: 'Metadata downloaded', message: `${dataset.columns.length} columns exported.` } });
  };

  const entries: MenuEntry[] = [
    { id: 'export', label: 'Download metadata', icon: Download, onSelect: exportRows },
    { id: 'rename', label: 'Rename', icon: Pencil, onSelect: () => setRenaming(true) },
    { id: 'delete-sep', kind: 'separator' },
    { id: 'delete', label: 'Delete', icon: Trash2, danger: true, onSelect: () => setDeleting(true) },
  ];

  return (
    <Modal title={dataset.name} onClose={onClose}>
      <div className="detail-overview">
        <span className="file-icon large">
          <Database size={20} />
        </span>
        <div>
          <StatusPill status={dataset.status} />
          <p>
            {dataset.source} · Updated {dataset.updated.toLowerCase()}
          </p>
        </div>
        <Menu label={`Options for ${dataset.name}`} entries={entries} />
      </div>
      <div className="detail-stats">
        <div>
          <span>Rows</span>
          <b>{dataset.rows}</b>
        </div>
        <div>
          <span>Variables</span>
          <b>{dataset.variables}</b>
        </div>
        <div>
          <span>Quality score</span>
          <b>{dataset.quality.toFixed(1)}%</b>
        </div>
      </div>
      <div className="detail-tabs" role="tablist" aria-label="Dataset details">
        <button type="button" role="tab" aria-selected={tab === 'variables'} className={tab === 'variables' ? 'active' : ''} onClick={() => setTab('variables')}>
          Defined variables
        </button>
        <button type="button" role="tab" aria-selected={tab === 'quality'} className={tab === 'quality' ? 'active' : ''} onClick={() => setTab('quality')}>
          Data quality
        </button>
      </div>
      {tab === 'variables' ? (
        dataset.columns.map((column) => (
          <div className="variable-row" key={column.name}>
            <code>{column.name}</code>
            <span>{column.type}</span>
            <small>{dataset.status === 'Needs review' ? 'Needs review' : 'Validated'}</small>
          </div>
        ))
      ) : (
        <div className="quality-list">
          {[
            ['Completeness', Math.min(100, dataset.quality + 1)],
            ['Uniqueness', Math.max(0, dataset.quality - 4)],
            ['Consistency', Math.max(0, dataset.quality - 2)],
            ['Timeliness', Math.min(100, dataset.quality + 3)],
          ].map(([label, value]) => (
            <div className="quality-row" key={String(label)}>
              <span>{label}</span>
              <i>
                <em style={{ width: `${value}%` }} />
              </i>
              <b>{value}%</b>
            </div>
          ))}
        </div>
      )}
      <div className="modal-actions">
        <button type="button" className="secondary-button" onClick={onClose}>
          Close
        </button>
        <button type="button" className="primary-button" onClick={exportRows}>
          Preview data <ChevronRight size={16} />
        </button>
      </div>
      {renaming && (
        <PromptDialog
          title="Rename dataset"
          label="Dataset name"
          initialValue={dataset.name}
          validate={(next) => (next === dataset.name ? 'Pick a different name.' : null)}
          onCancel={() => setRenaming(false)}
          onSubmit={(next) => {
            dispatch({ type: 'dataset/rename', id: dataset.id, name: next });
            dispatch({ type: 'toast/push', toast: { kind: 'success', title: 'Dataset renamed', message: `Now called “${next}”.` } });
            setRenaming(false);
          }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Delete this dataset?"
          message={`“${dataset.name}” and its ${dataset.variables} variables will be removed from the workspace.`}
          confirmLabel="Delete dataset"
          onCancel={() => setDeleting(false)}
          onConfirm={() => {
            dispatch({ type: 'dataset/delete', id: dataset.id });
            dispatch({ type: 'toast/push', toast: { kind: 'success', title: 'Dataset deleted', message: `${dataset.name} was removed.` } });
            setDeleting(false);
            onClose();
          }}
        />
      )}
    </Modal>
  );
}
