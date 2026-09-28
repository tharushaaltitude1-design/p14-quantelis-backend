import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Copy, Download, Plus, Search } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { SearchInput } from '@/components/ui/SearchInput';
import { Select } from '@/components/ui/Select';
import { FilterMenu } from '@/components/ui/FilterMenu';
import { Pagination } from '@/components/ui/Pagination';
import { Menu, type MenuEntry } from '@/components/ui/Menu';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ProjectCard, type ProjectAction } from './ProjectCard';
import { NewProjectWizard } from './NewProjectWizard';
import { ProjectDetailModal } from './ProjectDetailModal';
import { PROJECT_STATUSES, type Project, type ProjectStatus } from '@/data/mock';
import { useWorkspace, useWorkspaceDispatch } from '@/state/workspaceContext';
import { totalRuns } from '@/state/workspaceReducer';
import { useTableState, textMatcher } from '@/hooks/useTableState';
import { downloadCsv } from '@/lib/csv';

const PROJECT_PAGE_SIZE = 12;

const SORT_OPTIONS = [
  { value: 'name-asc', label: 'Name (A–Z)' },
  { value: 'name-desc', label: 'Name (Z–A)' },
  { value: 'runs-desc', label: 'Most runs' },
  { value: 'accuracy-desc', label: 'Accuracy (high–low)' },
];

const matchesProject = textMatcher<Project>((project) => [project.name, project.dataset, project.variable, project.horizon, project.status]);

export function ProjectsPage() {
  const { projects } = useWorkspace();
  const dispatch = useWorkspaceDispatch();
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ProjectStatus | 'all'>('all');
  const [datasetName, setDatasetName] = useState('all');
  const [sort, setSort] = useState('name-asc');
  const [wizard, setWizard] = useState(searchParams.get('new') === 'true');
  const [detail, setDetail] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState<Project | null>(null);
  const presetDataset = searchParams.get('dataset');

  const closeWizard = () => {
    setWizard(false);
    if (searchParams.has('new') || searchParams.has('dataset')) {
      searchParams.delete('new');
      searchParams.delete('dataset');
      setSearchParams(searchParams, { replace: true });
    }
  };

  const datasetNames = useMemo(() => [...new Set(projects.map((project) => project.dataset))].sort(), [projects]);
  const activeProjectCount = projects.filter((project) => project.status === 'Active').length;

  const isMatch = useMemo(
    () => (project: Project, needle: string) => matchesProject(project, needle) && (status === 'all' || project.status === status) && (datasetName === 'all' || project.dataset === datasetName),
    [status, datasetName],
  );

  const compare = useMemo(() => {
    const byName = (a: Project, b: Project) => a.name.localeCompare(b.name);
    switch (sort) {
      case 'name-desc':
        return (a: Project, b: Project) => byName(b, a);
      case 'runs-desc':
        return (a: Project, b: Project) => b.runs - a.runs;
      case 'accuracy-desc':
        return (a: Project, b: Project) => b.confidence - a.confidence;
      default:
        return byName;
    }
  }, [sort]);

  const { matched, pageRows, page, pageCount, total, setPage } = useTableState({ rows: projects, search, matches: isMatch, sort: compare, pageSize: 12, resetKey: `${status}|${datasetName}|${sort}` });

  const activeFilters = (status === 'all' ? 0 : 1) + (datasetName === 'all' ? 0 : 1);
  const clearFilters = () => {
    setStatus('all');
    setDatasetName('all');
  };

  const filterEntries: MenuEntry[] = [
    { id: 'status-label', kind: 'label', text: 'Status' },
    { id: 'status-all', label: 'All statuses', checked: status === 'all', onSelect: () => setStatus('all') },
    ...PROJECT_STATUSES.map((value) => ({ id: `status-${value}`, label: value, checked: status === value, onSelect: () => setStatus(value) })),
    { id: 'dataset-label', kind: 'label', text: 'Dataset' },
    { id: 'dataset-all', label: 'All datasets', checked: datasetName === 'all', onSelect: () => setDatasetName('all') },
    ...datasetNames.map((value) => ({ id: `dataset-${value}`, label: value, checked: datasetName === value, onSelect: () => setDatasetName(value) })),
  ];

  const toolbarEntries: MenuEntry[] = [
    {
      id: 'csv',
      label: 'Export CSV',
      icon: Download,
      onSelect: () => {
        downloadCsv('projects.csv', ['Name', 'Dataset', 'Variable', 'Horizon', 'Status', 'Runs'], matched.map((p) => [p.name, p.dataset, p.variable, p.horizon, p.status, p.runs]));
        dispatch({ type: 'toast/push', toast: { kind: 'success', title: 'Projects exported', message: `${matched.length} rows written to projects.csv.` } });
      },
    },
    {
      id: 'duplicate-all',
      label: 'Duplicate first result',
      icon: Copy,
      disabled: matched.length === 0,
      onSelect: () => {
        const first = matched[0];
        if (first) dispatch({ type: 'project/duplicate', id: first.id });
        dispatch({ type: 'toast/push', toast: { kind: 'success', title: 'Project duplicated', message: first ? `“${first.name}” was copied as a draft.` : 'Nothing to duplicate.' } });
      },
    },
    { id: 'clear', label: 'Clear search and filters', danger: true, disabled: !search && activeFilters === 0, onSelect: () => { setSearch(''); clearFilters(); } },
  ];

  const onAction = (action: ProjectAction, project: Project) => {
    switch (action) {
      case 'open':
        setDetail(project);
        break;
      case 'duplicate':
        dispatch({ type: 'project/duplicate', id: project.id });
        dispatch({ type: 'toast/push', toast: { kind: 'success', title: 'Project duplicated', message: `“${project.name}” was copied as a draft.` } });
        break;
      case 'archive':
        dispatch({ type: 'project/setStatus', id: project.id, status: 'Archived' });
        dispatch({ type: 'toast/push', toast: { kind: 'info', title: 'Project archived', message: `“${project.name}” moved to Archived.` } });
        break;
      case 'restore':
        dispatch({ type: 'project/setStatus', id: project.id, status: 'Active' });
        dispatch({ type: 'toast/push', toast: { kind: 'success', title: 'Project restored', message: `“${project.name}” is Active again.` } });
        break;
      case 'delete':
        setDeleting(project);
        break;
      default:
        break;
    }
  };

  return (
    <div className="page-stack">
      <div className="page-toolbar">
        <div className="toolbar-copy">
          <b>{activeProjectCount} active projects</b>
          <span>{totalRuns(projects)} total forecast runs</span>
        </div>
        <div className="button-row">
          <FilterMenu entries={filterEntries} activeCount={activeFilters} onClearAll={clearFilters} />
          <button className="primary-button" onClick={() => setWizard(true)}>
            <Plus size={17} /> New project
          </button>
        </div>
      </div>
      <div className="table-toolbar">
        <SearchInput value={search} onChange={setSearch} label="Search projects" placeholder="Search projects…" className="table-search" />
        <div className="button-row">
          <Select value={sort} onChange={setSort} options={SORT_OPTIONS} label="Sort projects" className="compact-select" />
          <Menu label="Project toolbar options" entries={toolbarEntries} />
        </div>
      </div>
      {total === 0 ? (
        <Card>
          <EmptyState
            icon={<Search size={28} />}
            title="No projects match"
            text="Adjust your search or clear the current filters."
            actionLabel="Clear search and filters"
            onAction={() => {
              setSearch('');
              clearFilters();
            }}
          />
        </Card>
      ) : (
        <section className="project-grid">
          {pageRows.map((project) => (
            <ProjectCard key={project.id} project={project} onAction={(action, target) => onAction(action, target)} />
          ))}
        </section>
      )}
      {total > 0 && (
        <Pagination page={page} pageCount={pageCount} total={total} noun="projects" pageSize={PROJECT_PAGE_SIZE} onPageChange={setPage} />
      )}
      {wizard && <NewProjectWizard onClose={closeWizard} onCreated={setDetail} initialDatasetId={presetDataset ?? undefined} />}
      {detail && <ProjectDetailModal project={detail} onClose={() => setDetail(null)} />}
      {deleting && (
        <ConfirmDialog
          title="Delete this project?"
          message={`“${deleting.name}” and its ${deleting.runs} recorded runs will be removed. This cannot be undone.`}
          confirmLabel="Delete project"
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            dispatch({ type: 'project/delete', id: deleting.id });
            dispatch({ type: 'toast/push', toast: { kind: 'success', title: 'Project deleted', message: `${deleting.name} was removed.` } });
            setDeleting(null);
          }}
        />
      )}
    </div>
  );
}
