import { useState } from 'react';
import { Copy, Edit3, GitCompare, Plus, Target, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Menu, type MenuEntry } from '@/components/ui/Menu';
import { FilterMenu } from '@/components/ui/FilterMenu';
import { SearchInput } from '@/components/ui/SearchInput';
import { Select } from '@/components/ui/Select';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Modal } from '@/components/ui/Modal';
import { useWorkspace, useWorkspaceDispatch } from '@/state/workspaceContext';
import { useTableState, textMatcher } from '@/hooks/useTableState';
import type { Scenario } from '@/data/mock';

const MAX_COMPARE = 4;
const PAGE_SIZE = 8;
const OBJECTIVES = ['Maximize accuracy', 'Maximize output', 'Minimize cost'];
const SORT_OPTIONS = [
  { value: 'score-desc', label: 'Score (high–low)' },
  { value: 'score-asc', label: 'Score (low–high)' },
  { value: 'name-asc', label: 'Name (A–Z)' },
];

const matchesScenario = textMatcher<Scenario>((s) => [s.name, s.project, s.params, s.objective]);

type ScenarioFilter = { objective: string; project: string };

export function ScenariosPage() {
  const { scenarios, projects } = useWorkspace();
  const dispatch = useWorkspaceDispatch();

  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('score-desc');
  const [filter, setFilter] = useState<ScenarioFilter>({ objective: 'all', project: 'all' });
  const [compare, setCompare] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Scenario | null>(null);
  const [deleting, setDeleting] = useState<Scenario | null>(null);

  const projectNames = Array.from(new Set(projects.map((p) => p.name)));

  const isMatch = (s: Scenario, needle: string) =>
    matchesScenario(s, needle) &&
    (filter.objective === 'all' || s.objective === filter.objective) &&
    (filter.project === 'all' || s.project === filter.project);

  const compareSort = (a: Scenario, b: Scenario) => {
    switch (sort) {
      case 'score-asc':
        return a.score - b.score;
      case 'name-asc':
        return a.name.localeCompare(b.name);
      default:
        return b.score - a.score;
    }
  };

  const { pageRows, page, pageCount, total, setPage } = useTableState({
    rows: scenarios,
    search,
    matches: isMatch,
    sort: compareSort,
    pageSize: PAGE_SIZE,
    resetKey: `${filter.objective}|${filter.project}|${sort}`,
  });

  const activeFilterCount = (filter.objective === 'all' ? 0 : 1) + (filter.project === 'all' ? 0 : 1);
  const selected = compare.map((id) => scenarios.find((s) => s.id === id)).filter((s): s is Scenario => Boolean(s));

  const toggleCompare = (id: string) => {
    setCompare((current) => {
      if (current.includes(id)) return current.filter((x) => x !== id);
      if (current.length >= MAX_COMPARE) {
        dispatch({ type: 'toast/push', toast: { kind: 'info', title: 'Comparison is full', message: `Compare up to ${MAX_COMPARE} scenarios at a time.` } });
        return current;
      }
      return [...current, id];
    });
  };

  const filterEntries: MenuEntry[] = [
    { id: 'obj-label', kind: 'label', text: 'Objective' },
    { id: 'obj-all', label: 'All objectives', checked: filter.objective === 'all', onSelect: () => setFilter((f) => ({ ...f, objective: 'all' })) },
    ...OBJECTIVES.map((o) => ({ id: `obj-${o}`, label: o, checked: filter.objective === o, onSelect: () => setFilter((f) => ({ ...f, objective: o })) })),
    { id: 'proj-label', kind: 'label', text: 'Project' },
    { id: 'proj-all', label: 'All projects', checked: filter.project === 'all', onSelect: () => setFilter((f) => ({ ...f, project: 'all' })) },
    ...projectNames.map((p) => ({ id: `proj-${p}`, label: p, checked: filter.project === p, onSelect: () => setFilter((f) => ({ ...f, project: p })) })),
  ];

  return (
    <div className="page-stack">
      <div className="page-toolbar">
        <div className="toolbar-copy">
          <b>{scenarios.length} scenarios</b>
          <span>Across {projectNames.length} forecasting projects</span>
        </div>
        <div className="button-row">
          <FilterMenu
            entries={filterEntries}
            activeCount={activeFilterCount}
            onClearAll={() => setFilter({ objective: 'all', project: 'all' })}
          />
          <button className="primary-button" onClick={() => setCreating(true)}>
            <Plus size={17} /> Create scenario
          </button>
        </div>
      </div>

      {compare.length > 0 && (
        <div className="compare-bar" role="region" aria-label="Scenario comparison">
          <span>
            <b>{compare.length}</b> of {MAX_COMPARE} selected
          </span>
          <div className="compare-chips">
            {selected.map((s) => (
              <button key={s.id} className="compare-chip" onClick={() => toggleCompare(s.id)} aria-label={`Remove ${s.name} from comparison`}>
                {s.name} <span aria-hidden="true">×</span>
              </button>
            ))}
          </div>
          <div className="button-row">
            <button className="secondary-button compact" onClick={() => setCompare([])}>
              Clear
            </button>
            <button
              className="primary-button compact"
              disabled={selected.length < 2}
              onClick={() => setCompareOpen(true)}
              title={selected.length < 2 ? 'Select at least two scenarios' : undefined}
            >
              <GitCompare size={15} /> Compare {selected.length}
            </button>
          </div>
        </div>
      )}

      <Card>
        <div className="table-toolbar">
          <SearchInput value={search} onChange={setSearch} label="Search scenarios" placeholder="Search scenarios…" className="table-search" />
          <Select value={sort} onChange={setSort} options={SORT_OPTIONS} label="Sort scenarios" className="compact-select" />
        </div>
        {total === 0 ? (
          <EmptyState
            icon={<Target size={28} />}
            title="No scenarios match"
            text="Adjust your search or clear the current filters."
            actionLabel="Clear search and filters"
            onAction={() => {
              setSearch('');
              setFilter({ objective: 'all', project: 'all' });
            }}
          />
        ) : (
          <>
            <div className="scenario-list">
              {pageRows.map((scenario) => {
                const checked = compare.includes(scenario.id);
                const atLimit = !checked && compare.length >= MAX_COMPARE;
                return (
                  <div className={`scenario-row ${checked ? 'selected' : ''}`} key={scenario.id}>
                    <button
                      className={`checkbox ${checked ? 'checked' : ''}`}
                      onClick={() => toggleCompare(scenario.id)}
                      role="checkbox"
                      aria-checked={checked}
                      aria-label={`Compare ${scenario.name}`}
                      disabled={atLimit}
                    >
                      {checked && <span aria-hidden="true">✓</span>}
                    </button>
                    <span className="scenario-score">{scenario.score}</span>
                    <span className="scenario-name">
                      <b>{scenario.name}</b>
                      <small>{scenario.project}</small>
                    </span>
                    <span className="scenario-params">{scenario.params}</span>
                    <span className="objective-tag">
                      <Target size={13} />
                      {scenario.objective}
                    </span>
                    <Menu
                      label={`Options for ${scenario.name}`}
                      entries={[
                        { id: 'edit', label: 'Edit', icon: Edit3, onSelect: () => setEditing(scenario) },
                        {
                          id: 'duplicate',
                          label: 'Duplicate',
                          icon: Copy,
                          onSelect: () => {
                            dispatch({ type: 'scenario/duplicate', id: scenario.id });
                            dispatch({ type: 'toast/push', toast: { kind: 'success', title: 'Scenario duplicated', message: `${scenario.name} was copied.` } });
                          },
                        },
                        { id: 'sep', kind: 'separator' },
                        { id: 'delete', label: 'Delete', icon: Trash2, danger: true, onSelect: () => setDeleting(scenario) },
                      ]}
                    />
                  </div>
                );
              })}
            </div>
            <Pagination page={page} pageCount={pageCount} total={total} noun="scenarios" pageSize={PAGE_SIZE} onPageChange={setPage} />
          </>
        )}
      </Card>

      {creating && <ScenarioDialog mode="create" onClose={() => setCreating(false)} />}
      {editing && <ScenarioDialog mode="edit" scenario={editing} onClose={() => setEditing(null)} />}
      {compareOpen && selected.length >= 2 && (
        <CompareModal
          scenarios={selected}
          onClose={() => setCompareOpen(false)}
          onClear={() => {
            setCompareOpen(false);
            setCompare([]);
          }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Delete this scenario?"
          message={`“${deleting.name}” will be removed from the library. This cannot be undone.`}
          confirmLabel="Delete scenario"
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            dispatch({ type: 'scenario/delete', id: deleting.id });
            dispatch({ type: 'toast/push', toast: { kind: 'success', title: 'Scenario deleted', message: `${deleting.name} was removed.` } });
            setDeleting(null);
            setCompare((current) => current.filter((id) => id !== deleting.id));
          }}
        />
      )}
    </div>
  );
}

type ScenarioDialogProps = { mode: 'create' | 'edit'; scenario?: Scenario; onClose: () => void };

function ScenarioDialog({ mode, scenario, onClose }: ScenarioDialogProps) {
  const { projects } = useWorkspace();
  const dispatch = useWorkspaceDispatch();
  const [name, setName] = useState(scenario?.name ?? '');
  const [project, setProject] = useState(scenario?.project ?? projects[0]?.name ?? '');
  const [params, setParams] = useState(scenario?.params ?? '');
  const [objective, setObjective] = useState(scenario?.objective ?? OBJECTIVES[0]);
  const [score, setScore] = useState(String(scenario?.score ?? 80));
  const [error, setError] = useState('');

  const submit = () => {
    if (name.trim().length < 3) return setError('Give the scenario a name of at least 3 characters.');
    if (params.trim().length < 3) return setError('Describe the scenario parameters.');
    const numericScore = Number(score);
    if (Number.isNaN(numericScore) || numericScore < 0 || numericScore > 100) return setError('Score must be between 0 and 100.');
    if (mode === 'create') {
      dispatch({ type: 'scenario/add', scenario: { name: name.trim(), project, params: params.trim(), objective, score: numericScore } });
      dispatch({ type: 'toast/push', toast: { kind: 'success', title: 'Scenario created', message: `${name.trim()} is now in the library.` } });
    } else if (scenario) {
      dispatch({ type: 'scenario/update', id: scenario.id, changes: { name: name.trim(), project, params: params.trim(), objective, score: numericScore } });
      dispatch({ type: 'toast/push', toast: { kind: 'success', title: 'Scenario updated', message: `${name.trim()} was saved.` } });
    }
    onClose();
  };

  return (
    <Modal title={mode === 'create' ? 'Create scenario' : 'Edit scenario'} onClose={onClose}>
      <div className="wizard-content">
        <label className="field-label" htmlFor="scenario-name">Name</label>
        <input id="scenario-name" className="text-input wizard-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Base case" aria-invalid={error ? true : undefined} />
        <label className="field-label" htmlFor="scenario-project">Project</label>
        <Select id="scenario-project" value={project} onChange={setProject} options={projects.map((p) => p.name)} label="Project" className="wizard-select" />
        <label className="field-label" htmlFor="scenario-params">Parameters</label>
        <input id="scenario-params" className="text-input wizard-input" value={params} onChange={(e) => setParams(e.target.value)} placeholder="e.g. +5% capacity · 99.5% uptime" />
        <label className="field-label" htmlFor="scenario-objective">Objective</label>
        <Select id="scenario-objective" value={objective} onChange={setObjective} options={OBJECTIVES} label="Objective" className="wizard-select" />
        <label className="field-label" htmlFor="scenario-score">Outcome score (0–100)</label>
        <input id="scenario-score" className="text-input wizard-input" type="number" min={0} max={100} value={score} onChange={(e) => setScore(e.target.value)} />
        {error && <span className="field-error" role="alert">{error}</span>}
      </div>
      <div className="modal-actions">
        <button className="secondary-button" onClick={onClose}>Cancel</button>
        <button className="primary-button" onClick={submit}>{mode === 'create' ? 'Create scenario' : 'Save changes'}</button>
      </div>
    </Modal>
  );
}

type CompareModalProps = { scenarios: Scenario[]; onClose: () => void; onClear: () => void };

function CompareModal({ scenarios, onClose, onClear }: CompareModalProps) {
  const winner = scenarios.reduce((best, s) => (s.score > best.score ? s : best), scenarios[0]);
  const rows = [
    ['Outcome score', (s: Scenario) => `${s.score}`],
    ['Objective', (s: Scenario) => s.objective],
    ['Project', (s: Scenario) => s.project],
    ['Parameters', (s: Scenario) => s.params],
  ] as const;

  return (
    <Modal title={`Compare ${scenarios.length} scenarios`} onClose={onClose}>
      <div className="compare-table" role="table" aria-label="Scenario comparison">
        <div className="compare-row compare-head" role="row">
          <span role="columnheader">Metric</span>
          {scenarios.map((s) => (
            <span role="columnheader" key={s.id} className={s.id === winner.id ? 'is-winner' : undefined}>
              {s.name}{s.id === winner.id ? ' ★' : ''}
            </span>
          ))}
        </div>
        {rows.map(([label, get]) => (
          <div className="compare-row" role="row" key={label}>
            <span role="rowheader">{label}</span>
            {scenarios.map((s) => (
              <span role="cell" key={s.id}>{get(s)}</span>
            ))}
          </div>
        ))}
      </div>
      <p className="compare-note">
        ★ <b>{winner.name}</b> leads with the highest outcome score ({winner.score}).
      </p>
      <div className="modal-actions">
        <button className="secondary-button" onClick={onClear}>Clear selection</button>
        <button className="primary-button" onClick={onClose}>Done</button>
      </div>
    </Modal>
  );
}
