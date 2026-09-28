import { Filter, X } from 'lucide-react';
import { Menu, type MenuEntry } from './Menu';

export type ActiveFilter = { key: string; label: string; onRemove: () => void };

type FilterMenuProps = {
  entries: MenuEntry[];
  /** Number of filters currently narrowing the list; drives the badge. */
  activeCount: number;
  onClearAll: () => void;
  label?: string;
  className?: string;
  /** Removable chips rendered outside the menu, e.g. beside the search field. */
  chips?: ActiveFilter[];
};

/**
 * Filter control built on the shared Menu. The badge always shows the real number of
 * active filters, "Clear all" appears as soon as any filter is on, and each active
 * filter can be dismissed individually from its chip.
 */
export function FilterMenu({ entries, activeCount, onClearAll, label = 'Filter', className = '', chips = [] }: FilterMenuProps) {
  const withClear: MenuEntry[] =
    activeCount > 0
      ? [{ id: '__clear', label: 'Clear all filters', onSelect: onClearAll, danger: true }, { id: '__sep', kind: 'separator' }, ...entries]
      : entries;
  return (
    <>
      <Menu
        label={`${label} options`}
        placement="bottom-end"
        entries={withClear}
        className={className}
        trigger={(props) => (
          <button {...props} type="button" className={`filter-button ${activeCount > 0 ? 'is-active' : ''}`}>
            <Filter size={15} /> {label} {activeCount > 0 && <span className="filter-count">{activeCount}</span>}
          </button>
        )}
      />
      {chips.length > 0 && (
        <div className="filter-chips">
          {chips.map((chip) => (
            <span className="filter-chip" key={chip.key}>
              {chip.label}
              <button type="button" onClick={chip.onRemove} aria-label={`Remove ${chip.label} filter`}>
                <X size={13} />
              </button>
            </span>
          ))}
        </div>
      )}
    </>
  );
}
