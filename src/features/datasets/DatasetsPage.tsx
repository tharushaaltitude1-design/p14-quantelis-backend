import { ArrowUpDown, UploadCloud } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { SearchInput } from '@/components/ui/SearchInput';
import { Select } from '@/components/ui/Select';
import { Pagination } from '@/components/ui/Pagination';
import { FilterMenu } from '@/components/ui/FilterMenu';
import { Menu, type MenuEntry } from '@/components/ui/Menu';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { PromptDialog } from '@/components/ui/PromptDialog';
import { DatasetRow, type DatasetAction } from './DatasetRow';
import { UploadDatasetModal } from './UploadDatasetModal';
import { DatasetDetailModal } from './DatasetDetailModal';
import { DATASET_STATUSES, type Dataset, type DatasetStatus } from '@/data/mock';
import { useWorkspace, useWorkspaceDispatch } from '@/state/workspaceContext';
import { useTableState, textMatcher } from '@/hooks/useTableState';
import { downloadCsv } from '@/lib/csv';

const PAGE_SIZES = [5, 10, 25];
const SORT_OPTIONS = [
  { value: 'name-asc', label: 'Name (A–Z)' },
  { value: 'name-desc', label: 'Name (Z–A)' },
  { value: 'rows-desc', label: 'Rows (high–low)' },
  { value: 'updated-desc', label: 'Recently updated' },
];

const matchesDataset = textMatcher<Dataset>((dataset) => [dataset.name, dataset.source, dataset.status, dataset.id]);

export function DatasetsPage() {
  const { datasets } = useWorkspace();
  const dispatch = useWorkspaceDispatch();
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<DatasetStatus | 'all'>('all');
  const [source, setSource] = useState('all');
  const [sort, setSort] = useState('name-asc');
  const [pageSize, setPageSize] = useState(PAGE_SIZES[1]);

  const [showUpload, setShowUpload] = useState(searchParams.get('upload') === 'true');
  const [selected, setSelected] = useState<Dataset | null>(null);
  const [renaming, setRenaming] = useState<Dataset | null>(null);
  const [deleting, setDeleting] = useState<Dataset | null>(null);

  const closeUpload = useCallback(() => {
    setShowUpload(false);
    if (searchParams.has('upload')) {
      searchParams.delete('upload');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const sources = useMemo(() => [...new Set(datasets.map((dataset) => dataset.source))].sort(), [datasets]);

  const isMatch = useCallback(
    (dataset: Dataset, needle: string) => matchesDataset(dataset, needle) && (status === 'all' || dataset.status === status) && (source === 'all' || dataset.source === source),
    [status, source],
  );

  const compare = useMemo(() => {
    const byName = (a: Dataset, b: Dataset) => a.name.localeCompare(b.name);
    switch (sort) {
      case 'name-desc':
        return (a: Dataset, b: Dataset) => byName(b, a);
      case 'rows-desc':
        return (a: Dataset, b: Dataset) => Number(b.rows.replace(/[^0-9]/g, '')) - Number(a.rows.replace(/[^0-9]/g, ''));
      case 'updated-desc':
        return (a: Dataset, b: Dataset) => (a.updated < b.updated ? 1 : -1);
      default:
        return byName;
    }
  }, [sort]);

  const { pageRows, page, pageCount, total, setPage } = useTableState({ rows: datasets, search, matches: isMatch, sort: compare, pageSize, resetKey: `${status}|${source}|${sort}` });

  const activeFilters = (status === 'all' ? 0 : 1) + (source === 'all' ? 0 : 1);
  const clearAll = () => {
    setStatus('all');
    setSource('all');
  };

  const filterEntries: MenuEntry[] = [
    { id: 'status-label', kind: 'label', text: 'Status' },
    { id: 'status-all', label: 'All statuses', checked: status === 'all', onSelect: () => setStatus('all') },
    ...DATASET_STATUSES.map((value) => ({ id: `status-${value}`, label: value, checked: status === value, onSelect: () => setStatus(value) })),
    { id: 'source-label', kind: 'label', text: 'Source' },
    { id: 'source-all', label: 'All sources', checked: source === 'all', onSelect: () => setSource('all') },
    ...sources.map((value) => ({ id: `source-${value}`, label: value, checked: source === value, onSelect: () => setSource(value) })),
  ];

  const toolbarEntries: MenuEntry[] = [
    {
      id: 'csv',
      label: 'Export filtered as CSV',
      onSelect: () => {
        downloadCsv('datasets.csv', ['Name', 'Source', 'Rows', 'Variables', 'Status', 'Updated'], pageRows.map((d) => [d.name, d.source, d.rows, d.variables, d.status, d.updated]));
        dispatch({ type: 'toast/push', toast: { kind: 'success', title: 'Datasets exported', message: `${pageRows.length} rows written to datasets.csv.` } });
      },
    },
    { id: 'clear', label: 'Clear search and filters', danger: true, disabled: !search && activeFilters === 0, onSelect: () => { setSearch(''); clearAll(); } },
  ];

  const onRowAction = (action: DatasetAction, dataset: Dataset) => {
    if (action === 'view') setSelected(dataset);
    else if (action === 'rename') setRenaming(dataset);
    else if (action === 'delete') setDeleting(dataset);
    else if (action === 'use') {
      dispatch({ type: 'toast/push', toast: { kind: 'info', title: 'New project', message: `Select “${dataset.name}” in the dataset step.` } });
      setSearchParams({ new: 'true', dataset: dataset.id });
    }
  };

  return (
    <div className="page-stack">
      <div className="page-toolbar">
        <div className="toolbar-copy">
          <b>{datasets.length} datasets</b>
          <span>All sources synced this week</span>
        </div>
        <button className="primary-button" onClick={() => setShowUpload(true)}>
          <UploadCloud size={17} /> Upload dataset
        </button>
      </div>
      <Card>
        <div className="table-toolbar">
          <SearchInput value={search} onChange={setSearch} label="Search datasets" placeholder="Search datasets…" className="table-search" />
          <div className="button-row">
            <Select value={sort} onChange={setSort} options={SORT_OPTIONS} label="Sort datasets" className="compact-select" />
            <FilterMenu entries={filterEntries} activeCount={activeFilters} onClearAll={clearAll} />
            <Menu
              label="Dataset toolbar options"
              entries={toolbarEntries}
              trigger={(props) => (
                <button {...props} type="button" className="icon-button" aria-label="Dataset toolbar options">
                  <ArrowUpDown size={17} />
                </button>
              )}
            />
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Dataset name</th>
                <th>Source</th>
                <th>Rows</th>
                <th>Variables</th>
                <th>Last updated</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {pageRows.map((dataset) => (
                <DatasetRow key={dataset.id} dataset={dataset} onOpen={setSelected} onAction={onRowAction} />
              ))}
            </tbody>
          </table>
          {total === 0 && (
            <EmptyState
              icon={<UploadCloud size={28} />}
              title="No datasets found"
              text={search || activeFilters > 0 ? 'Try adjusting your search or clear the current filters.' : 'Upload a dataset to get started.'}
              actionLabel={search || activeFilters > 0 ? 'Clear search and filters' : undefined}
              onAction={search || activeFilters > 0 ? () => { setSearch(''); clearAll(); } : undefined}
            />
          )}
        </div>
        <Pagination
          page={page}
          pageCount={pageCount}
          total={total}
          noun="datasets"
          pageSize={pageSize}
          pageSizes={PAGE_SIZES}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </Card>
      {showUpload && <UploadDatasetModal onClose={closeUpload} />}
      {selected && <DatasetDetailModal dataset={selected} onClose={() => setSelected(null)} />}
      {renaming && (
        <PromptDialog
          title="Rename dataset"
          label="Dataset name"
          initialValue={renaming.name}
          validate={(next) => (next === renaming.name ? 'Pick a different name.' : null)}
          onCancel={() => setRenaming(null)}
          onSubmit={(next) => {
            dispatch({ type: 'dataset/rename', id: renaming.id, name: next });
            dispatch({ type: 'toast/push', toast: { kind: 'success', title: 'Dataset renamed', message: `Now called “${next}”.` } });
            setRenaming(null);
          }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Delete this dataset?"
          message={`“${deleting.name}” and its ${deleting.variables} variables will be removed from the workspace. Projects using it keep their last run.`}
          confirmLabel="Delete dataset"
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            dispatch({ type: 'dataset/delete', id: deleting.id });
            dispatch({ type: 'toast/push', toast: { kind: 'success', title: 'Dataset deleted', message: `${deleting.name} was removed.` } });
            setDeleting(null);
          }}
        />
      )}
    </div>
  );
}
