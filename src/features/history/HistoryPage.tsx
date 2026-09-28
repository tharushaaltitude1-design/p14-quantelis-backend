import { useState } from 'react';
import { ChevronRight, Copy, Download, ExternalLink } from 'lucide-react';
import { ActivityIcon } from '@/components/ui/ActivityIcon';
import { Card } from '@/components/ui/Card';
import { StatusPill } from '@/components/ui/StatusPill';
import { SearchInput } from '@/components/ui/SearchInput';
import { Select } from '@/components/ui/Select';
import { FilterMenu, type ActiveFilter } from '@/components/ui/FilterMenu';
import { Menu, type MenuEntry } from '@/components/ui/Menu';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { useWorkspace, useWorkspaceDispatch } from '@/state/workspaceContext';
import { useTableState, textMatcher } from '@/hooks/useTableState';
import { downloadCsv } from '@/lib/csv';
import type { ActivityEntry } from '@/data/mock';

const PAGE_SIZE = 8;
const TYPES: ActivityEntry['type'][] = ['forecast', 'dataset', 'scenario', 'team', 'security'];
const TYPE_LABELS: Record<ActivityEntry['type'], string> = {
  forecast: 'Forecast runs',
  dataset: 'Dataset activity',
  scenario: 'Scenario activity',
  team: 'Team activity',
  security: 'Security activity',
};
const STATUSES = ['All statuses', 'Completed', 'Processing', 'Needs review', 'Failed'];
const RANGES = ['All time', 'Last 7 days', 'Last 30 days', 'Last 90 days'];

const RECENCY_DAYS: Record<string, number> = { 'Last 7 days': 7, 'Last 30 days': 30, 'Last 90 days': 90 };
const dateOf = (item: ActivityEntry) => new Date(item.time);
const daysAgoOf = (item: ActivityEntry) => {
  const parsed = /(\d+)\s+(minute|hour|day)s?\s+ago/.exec(item.time);
  if (parsed) return Number(parsed[1]) / (parsed[2] === 'day' ? 1 : parsed[2] === 'hour' ? 24 : 1440);
  const month = /(\w+) (\d+), (\d{4})/.exec(item.time);
  if (!month) return 0;
  return (Date.now() - dateOf(item).getTime()) / 86_400_000;
};

const matchesEntry = textMatcher<ActivityEntry>((item) => [item.title, item.detail, item.status, item.ref, item.type]);

type HistoryFilter = { types: ActivityEntry['type'][]; status: string; range: string };

export function HistoryPage() {
  const { activity } = useWorkspace();
  const dispatch = useWorkspaceDispatch();

  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('newest');
  const [filter, setFilter] = useState<HistoryFilter>({ types: [], status: 'All statuses', range: 'All time' });
  const [detail, setDetail] = useState<ActivityEntry | null>(null);

  const isMatch = (item: ActivityEntry, needle: string) => {
    if (!matchesEntry(item, needle)) return false;
    if (filter.types.length > 0 && !filter.types.includes(item.type)) return false;
    if (filter.status !== 'All statuses' && item.status !== filter.status) return false;
    const limit = RECENCY_DAYS[filter.range];
    if (limit !== undefined && daysAgoOf(item) > limit) return false;
    return true;
  };

  const sortEntries = (a: ActivityEntry, b: ActivityEntry) => (sort === 'oldest' ? dateOf(a).getTime() - dateOf(b).getTime() : dateOf(b).getTime() - dateOf(a).getTime());

  const { matched, pageRows, page, pageCount, total, setPage } = useTableState({
    rows: activity,
    search,
    matches: isMatch,
    sort: sortEntries,
    pageSize: PAGE_SIZE,
    resetKey: `${filter.types.join()}|${filter.status}|${filter.range}|${sort}`,
  });

  const activeFilterCount = filter.types.length + (filter.status === 'All statuses' ? 0 : 1) + (filter.range === 'All time' ? 0 : 1);
  const clearFilters = () => setFilter({ types: [], status: 'All statuses', range: 'All time' });

  const filterEntries: MenuEntry[] = [
    { id: 'type-label', kind: 'label', text: 'Activity type' },
    ...TYPES.map((type) => ({
      id: `type-${type}`,
      label: TYPE_LABELS[type],
      checked: filter.types.includes(type),
      onSelect: () =>
        setFilter((current) => ({
          ...current,
          types: current.types.includes(type) ? current.types.filter((t) => t !== type) : [...current.types, type],
        })),
    })),
    { id: 'status-label', kind: 'label', text: 'Status' },
    ...STATUSES.map((value) => ({ id: `status-${value}`, label: value, checked: filter.status === value, onSelect: () => setFilter((current) => ({ ...current, status: value })) })),
    { id: 'range-label', kind: 'label', text: 'Time range' },
    ...RANGES.map((value) => ({ id: `range-${value}`, label: value, checked: filter.range === value, onSelect: () => setFilter((current) => ({ ...current, range: value })) })),
  ];

  const chips: ActiveFilter[] = [
    ...filter.types.map((type) => ({ key: `type-${type}`, label: TYPE_LABELS[type], onRemove: () => setFilter((c) => ({ ...c, types: c.types.filter((t) => t !== type) })) })),
    ...(filter.status === 'All statuses' ? [] : [{ key: 'status', label: filter.status, onRemove: () => setFilter((c) => ({ ...c, status: 'All statuses' })) }]),
    ...(filter.range === 'All time' ? [] : [{ key: 'range', label: filter.range, onRemove: () => setFilter((c) => ({ ...c, range: 'All time' })) }]),
  ];

  const copyRef = async (item: ActivityEntry) => {
    try {
      await navigator.clipboard.writeText(item.ref);
      dispatch({ type: 'toast/push', toast: { kind: 'success', title: 'Reference copied', message: item.ref } });
    } catch {
      dispatch({ type: 'toast/push', toast: { kind: 'danger', title: 'Copy failed', message: 'Your browser blocked clipboard access.' } });
    }
  };

  return (
    <div className="page-stack">
      <div className="page-toolbar">
        <div className="toolbar-copy">
          <b>{total} of {activity.length} activity records</b>
          <span>All workspace activity</span>
        </div>
        <div className="button-row">
          <FilterMenu entries={filterEntries} activeCount={activeFilterCount} onClearAll={clearFilters} chips={chips} />
          <Menu
            label="History export options"
            entries={[
              {
                id: 'csv',
                label: 'Export CSV',
                icon: Download,
                onSelect: () => {
                  downloadCsv('activity-history.csv', ['Reference', 'Title', 'Detail', 'Type', 'Status', 'Time'], matched.map((m) => [m.ref, m.title, m.detail, TYPE_LABELS[m.type], m.status, m.time]));
                  dispatch({ type: 'toast/push', toast: { kind: 'success', title: 'History exported', message: `${matched.length} records written to activity-history.csv.` } });
                },
              },
            ]}
          />
        </div>
      </div>
      <Card>
        <div className="table-toolbar">
          <SearchInput value={search} onChange={setSearch} label="Search activity" placeholder="Search activity…" className="table-search" />
          <div className="button-row">
            <Select value={sort} onChange={setSort} options={['newest', 'oldest'].map((v) => ({ value: v, label: v === 'newest' ? 'Newest first' : 'Oldest first' }))} label="Sort activity" className="compact-select" />
          </div>
        </div>
        {total === 0 ? (
          <EmptyState
            icon={<ActivityIcon type="forecast" />}
            title="No activity matches"
            text="Adjust your search or clear the current filters."
            actionLabel="Clear search and filters"
            onAction={() => {
              setSearch('');
              clearFilters();
            }}
          />
        ) : (
          <>
            <div className="history-list">
              {pageRows.map((item) => (
                <div className="history-row" key={item.ref}>
                  <ActivityIcon type={item.type} />
                  <span>
                    <b>{item.detail}</b>
                    <small>{item.title}</small>
                  </span>
                  <span className="history-date">{item.time}</span>
                  <StatusPill status={item.status} />
                  <Menu
                    label={`Options for ${item.ref}`}
                    entries={[
                      { id: 'details', label: 'View details', icon: ChevronRight, onSelect: () => setDetail(item) },
                      { id: 'copy', label: 'Copy reference', icon: Copy, onSelect: () => void copyRef(item) },
                      { id: 'sep', kind: 'separator' },
                      {
                        id: 'csv-row',
                        label: 'Export this record',
                        icon: Download,
                        onSelect: () => {
                          downloadCsv(`${item.ref}.csv`, ['Reference', 'Title', 'Detail', 'Type', 'Status', 'Time'], [[item.ref, item.title, item.detail, TYPE_LABELS[item.type], item.status, item.time]]);
                          dispatch({ type: 'toast/push', toast: { kind: 'success', title: 'Record exported', message: `${item.ref} written to CSV.` } });
                        },
                      },
                    ]}
                    trigger={(props) => (
                      <button {...props} type="button" className="link-button">
                        Details <ChevronRight size={14} />
                      </button>
                    )}
                  />
                </div>
              ))}
            </div>
            <Pagination page={page} pageCount={pageCount} total={total} noun="records" pageSize={PAGE_SIZE} onPageChange={setPage} />
          </>
        )}
      </Card>
      {detail && <ActivityDetailModal entry={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

function ActivityDetailModal({ entry, onClose }: { entry: ActivityEntry; onClose: () => void }) {
  const dispatch = useWorkspaceDispatch();
  return (
    <Modal title={entry.title} onClose={onClose}>
      <div className="detail-overview">
        <ActivityIcon type={entry.type} />
        <div>
          <StatusPill status={entry.status} />
          <p>{entry.detail}</p>
        </div>
      </div>
      <div className="detail-stats">
        <div>
          <span>Reference</span>
          <b>{entry.ref}</b>
        </div>
        <div>
          <span>Type</span>
          <b>{TYPE_LABELS[entry.type]}</b>
        </div>
        <div>
          <span>When</span>
          <b>{entry.time}</b>
        </div>
      </div>
      <p className="compare-note">
        <ExternalLink size={13} /> Full run logs are retained for 90 days in this workspace build.
      </p>
      <div className="modal-actions">
        <button type="button" className="secondary-button" onClick={onClose}>
          Close
        </button>
        <button
          type="button"
          className="primary-button"
          onClick={() => {
            void navigator.clipboard
              .writeText(entry.ref)
              .then(() => dispatch({ type: 'toast/push', toast: { kind: 'success', title: 'Reference copied', message: entry.ref } }))
              .catch(() => dispatch({ type: 'toast/push', toast: { kind: 'danger', title: 'Copy failed', message: 'Your browser blocked clipboard access.' } }));
          }}
        >
          <Copy size={15} /> Copy reference
        </button>
      </div>
    </Modal>
  );
}
