import { Database, Download, Eye, Pencil, Plus, Trash2 } from 'lucide-react';
import type { Dataset } from '@/data/mock';
import type { MenuEntry } from '@/components/ui/Menu';
import { Menu } from '@/components/ui/Menu';
import { StatusPill } from '@/components/ui/StatusPill';
import { downloadCsv } from '@/lib/csv';
import { useWorkspaceDispatch } from '@/state/workspaceContext';

export type DatasetAction = 'view' | 'rename' | 'metadata' | 'use' | 'delete';

type DatasetRowProps = {
  dataset: Dataset;
  onOpen: (dataset: Dataset) => void;
  onAction: (action: DatasetAction, dataset: Dataset) => void;
};

/** Presentational table row. Dialogs are owned by the page so no <div> is rendered inside <tr>. */
export function DatasetRow({ dataset, onOpen, onAction }: DatasetRowProps) {
  const dispatch = useWorkspaceDispatch();

  const entries: MenuEntry[] = [
    { id: 'view', label: 'View details', icon: Eye, onSelect: () => onOpen(dataset) },
    { id: 'rename', label: 'Rename', icon: Pencil, onSelect: () => onAction('rename', dataset) },
    {
      id: 'metadata',
      label: 'Download metadata',
      icon: Download,
      onSelect: () => {
        downloadCsv(`${dataset.id}-metadata.csv`, ['Column', 'Type'], dataset.columns.map((column) => [column.name, column.type]));
        dispatch({ type: 'toast/push', toast: { kind: 'success', title: 'Metadata downloaded', message: `${dataset.columns.length} columns exported for ${dataset.name}.` } });
      },
    },
    { id: 'use', label: 'Use in new project', icon: Plus, onSelect: () => onAction('use', dataset) },
    { id: 'row-separator', kind: 'separator' },
    { id: 'delete', label: 'Delete', icon: Trash2, danger: true, onSelect: () => onAction('delete', dataset) },
  ];

  return (
    <tr>
      <td>
        <button type="button" className="table-name" onClick={() => onOpen(dataset)}>
          <span className="file-icon">
            <Database size={15} />
          </span>
          <span>
            <b>{dataset.name}</b>
            <small>ID / {dataset.id.toUpperCase()}</small>
          </span>
        </button>
      </td>
      <td>{dataset.source}</td>
      <td className="tabular">{dataset.rows}</td>
      <td className="tabular">{dataset.variables}</td>
      <td>{dataset.updated}</td>
      <td>
        <StatusPill status={dataset.status} />
      </td>
      <td>
        <Menu label={`Options for ${dataset.name}`} entries={entries} />
      </td>
    </tr>
  );
}
