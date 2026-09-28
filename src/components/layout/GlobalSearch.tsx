import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { BarChart3, Compass, Database, FileClock, Search, Settings, ShieldCheck, SlidersHorizontal, User, type LucideIcon } from 'lucide-react';
import { useWorkspace } from '@/state/workspaceContext';
import { pageMeta } from './pageMeta';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { useFocusTrap } from '@/hooks/useFocusTrap';

type Result = { id: string; group: string; title: string; subtitle: string; to: string; icon: LucideIcon };

const PAGE_RESULTS: Result[] = [
  { id: 'page-overview', group: 'Pages', title: 'Overview', subtitle: pageMeta('/').subtitle, to: '/', icon: Compass },
  { id: 'page-datasets', group: 'Pages', title: 'Datasets', subtitle: pageMeta('/datasets').subtitle, to: '/datasets', icon: Database },
  { id: 'page-projects', group: 'Pages', title: 'Forecasting projects', subtitle: pageMeta('/projects').subtitle, to: '/projects', icon: BarChart3 },
  { id: 'page-scenarios', group: 'Pages', title: 'Scenarios & optimization', subtitle: pageMeta('/scenarios').subtitle, to: '/scenarios', icon: SlidersHorizontal },
  { id: 'page-history', group: 'Pages', title: 'Results & history', subtitle: pageMeta('/history').subtitle, to: '/history', icon: FileClock },
  { id: 'page-settings', group: 'Pages', title: 'Settings', subtitle: pageMeta('/settings').subtitle, to: '/settings', icon: Settings },
  { id: 'page-security', group: 'Pages', title: 'Security', subtitle: pageMeta('/security').subtitle, to: '/security', icon: ShieldCheck },
  { id: 'page-profile', group: 'Pages', title: 'Your profile', subtitle: pageMeta('/profile').subtitle, to: '/profile', icon: User },
];

function useResults(query: string): Result[] {
  const { datasets, projects, scenarios, activity } = useWorkspace();
  return useMemo(() => {
    const needle = query.trim().toLowerCase();
    const entities: Result[] = [
      ...datasets.map((d) => ({ id: d.id, group: 'Datasets', title: d.name, subtitle: `${d.source} · ${d.rows} rows`, to: '/datasets', icon: Database })),
      ...projects.map((p) => ({ id: p.id, group: 'Projects', title: p.name, subtitle: `${p.dataset} · ${p.horizon}`, to: '/projects', icon: BarChart3 })),
      ...scenarios.map((s) => ({ id: s.id, group: 'Scenarios', title: s.name, subtitle: `${s.project} · score ${s.score}`, to: '/scenarios', icon: SlidersHorizontal })),
      ...activity.map((a) => ({ id: a.id, group: 'Activity', title: a.detail, subtitle: `${a.title} · ${a.time}`, to: '/history', icon: FileClock })),
    ];
    if (!needle) {
      const pages = PAGE_RESULTS.slice(0, 5);
      return [...entities.slice(0, 4), ...pages];
    }
    return [...entities, ...PAGE_RESULTS].filter((item) => `${item.title} ${item.subtitle} ${item.group}`.toLowerCase().includes(needle)).slice(0, 12);
  }, [query, datasets, projects, scenarios, activity]);
}

type CommandPaletteProps = { onClose: () => void };

function CommandPalette({ onClose }: CommandPaletteProps) {
  const navigate = useNavigate();
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const results = useResults(query);

  useEscapeKey(true, onClose);
  useFocusTrap(panelRef);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const choose = useCallback(
    (result: Result) => {
      onClose();
      navigate(result.to);
    },
    [navigate, onClose],
  );

  const move = (delta: number) => {
    if (results.length === 0) return;
    setActiveIndex((current) => (current + delta + results.length) % results.length);
  };

  const grouped = useMemo(() => {
    const map = new Map<string, Result[]>();
    for (const result of results) map.set(result.group, [...(map.get(result.group) ?? []), result]);
    return [...map.entries()];
  }, [results]);

  return createPortal(
    <div className="command-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <div className="command-panel" role="dialog" aria-modal="true" aria-label="Search workspace" ref={panelRef} tabIndex={-1}>
        <div className="command-search">
          <Search size={18} aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls="command-results"
            aria-autocomplete="list"
            aria-label="Search datasets, projects, scenarios, activity and pages"
            placeholder="Search datasets, projects, scenarios, activity…"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                move(1);
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                move(-1);
              } else if (event.key === 'Enter') {
                event.preventDefault();
                const result = results[activeIndex];
                if (result) choose(result);
              }
            }}
          />
        </div>
        <div className="command-results" id="command-results" role="listbox" aria-label="Search results">
          {results.length === 0 ? (
            <div className="command-empty">
              <Search size={22} aria-hidden="true" />
              <b>No results for “{query.trim()}”</b>
              <span>Try a dataset, project, scenario or page name.</span>
            </div>
          ) : (
            grouped.map(([group, items]) => (
              <div key={group} role="group" aria-label={group}>
                <span className="command-group-label">{group}</span>
                {items.map((item) => {
                  const index = results.indexOf(item);
                  const Icon = item.icon;
                  return (
                    <button
                      key={`${group}-${item.id}`}
                      type="button"
                      role="option"
                      aria-selected={index === activeIndex}
                      className={`command-item ${index === activeIndex ? 'is-active' : ''}`}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => choose(item)}
                    >
                      <span className="command-item-icon">
                        <Icon size={14} />
                      </span>
                      <span className="command-item-copy">
                        <b>{item.title}</b>
                        <small>{item.subtitle}</small>
                      </span>
                      <span className="command-item-kind">{item.group}</span>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
        <div className="command-footer">
          <span>
            <kbd>↑</kbd> <kbd>↓</kbd> to navigate
          </span>
          <span>
            <kbd>Enter</kbd> to open
          </span>
          <span>
            <kbd>Esc</kbd> to close
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}

type GlobalSearchProps = { open: boolean; onClose: () => void };

/** Workspace-wide command palette. Render once near the top of the shell. */
export function GlobalSearch({ open, onClose }: GlobalSearchProps) {
  if (!open) return null;
  return <CommandPalette onClose={onClose} />;
}
