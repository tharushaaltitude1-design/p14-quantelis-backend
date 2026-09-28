import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Check, MoreHorizontal, type LucideIcon } from 'lucide-react';
import { Popover } from './Popover';
import type { MenuPlacement } from '@/lib/menuPosition';

export type MenuAction = {
  id: string;
  label: string;
  icon?: LucideIcon;
  onSelect?: () => void;
  danger?: boolean;
  disabled?: boolean;
  checked?: boolean;
  shortcut?: string;
};

export type MenuEntry = MenuAction | { kind: 'separator'; id: string } | { kind: 'label'; id: string; text: string };

export type MenuTriggerProps = {
  ref: React.Ref<HTMLButtonElement>;
  onClick: () => void;
  'aria-haspopup': 'menu';
  'aria-expanded': boolean;
  'aria-controls': string;
};

type MenuProps = {
  entries: MenuEntry[];
  /** Accessible name for the menu and for the default 3-dot trigger. */
  label: string;
  placement?: MenuPlacement;
  /** Render a custom trigger (e.g. a text button) instead of the default icon button. */
  trigger?: (props: MenuTriggerProps) => ReactNode;
  onOpenChange?: (open: boolean) => void;
  className?: string;
};

function isAction(entry: MenuEntry): entry is MenuAction {
  return !('kind' in entry);
}

function MenuBody({ entries, activeId, setActiveId, onSelect, itemRefs }: {
  entries: MenuEntry[];
  activeId: string | null;
  setActiveId: (id: string | null) => void;
  onSelect: (entry: MenuAction) => void;
  itemRefs: React.MutableRefObject<Map<string, HTMLButtonElement>>;
}) {
  // Autofocus the first item once per open. A ref guard keeps a changing `entries` array
  // from yanking focus back while the user arrows through the menu.
  const hasFocused = useRef(false);
  useEffect(() => {
    if (hasFocused.current) return;
    hasFocused.current = true;
    const first = entries.find(isAction);
    if (first) {
      setActiveId(first.id);
      itemRefs.current.get(first.id)?.focus();
    }
  }, [entries, itemRefs, setActiveId]);

  return (
    <>
      {entries.map((entry) => {
        if (!isAction(entry)) {
          return entry.kind === 'separator' ? <div key={entry.id} className="menu-separator" role="separator" /> : <span key={entry.id} className="menu-label">{entry.text}</span>;
        }
        const Icon = entry.icon;
        return (
          <button
            key={entry.id}
            ref={(node) => {
              if (node) itemRefs.current.set(entry.id, node);
              else itemRefs.current.delete(entry.id);
            }}
            type="button"
            role="menuitem"
            tabIndex={entry.id === activeId ? 0 : -1}
            className={`menu-item ${entry.danger ? 'danger' : ''}`}
            disabled={entry.disabled}
            onClick={() => onSelect(entry)}
            onMouseEnter={() => setActiveId(entry.id)}
          >
            {Icon && <Icon size={15} />}
            <span className="menu-item-label">{entry.label}</span>
            {entry.shortcut && <span className="menu-item-shortcut">{entry.shortcut}</span>}
            {entry.checked && (
              <span className="menu-check">
                <Check size={14} />
              </span>
            )}
          </button>
        );
      })}
    </>
  );
}

export function Menu({ entries, label, placement = 'bottom-end', trigger, onOpenChange, className = '' }: MenuProps) {
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef(new Map<string, HTMLButtonElement>());
  const menuId = useId();

  // Imperative handlers read entries through a ref so their effect dependencies stay stable:
  // callers naturally build a fresh `entries` array on every render.
  const entriesRef = useRef(entries);
  entriesRef.current = entries;

  const setOpenState = useCallback(
    (next: boolean, returnFocus: boolean) => {
      setOpen(next);
      onOpenChange?.(next);
      if (!next) {
        setActiveId(null);
        if (returnFocus) triggerRef.current?.focus();
      }
    },
    [onOpenChange],
  );

  const close = useCallback(() => setOpenState(false, true), [setOpenState]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const actions = entriesRef.current.filter(isAction);
      const focusBy = (id: string) => {
        setActiveId(id);
        itemRefs.current.get(id)?.focus();
      };
      if (event.key === 'Escape') {
        event.stopPropagation();
        close();
        return;
      }
      if (actions.length === 0) return;
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const current = actions.findIndex((entry) => entry.id === activeId);
        const delta = event.key === 'ArrowDown' ? 1 : -1;
        const next = actions[(current + delta + actions.length) % actions.length];
        if (next) focusBy(next.id);
        return;
      }
      if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        const next = event.key === 'Home' ? actions[0] : actions[actions.length - 1];
        if (next) focusBy(next.id);
        return;
      }
      if (event.key === 'Tab') setOpenState(false, false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, activeId, close, setOpenState]);

  const select = useCallback(
    (entry: MenuAction) => {
      if (entry.disabled) return;
      setOpenState(false, true);
      entry.onSelect?.();
    },
    [setOpenState],
  );

  const triggerProps: MenuTriggerProps = {
    ref: triggerRef,
    onClick: () => setOpenState(!open, false),
    'aria-haspopup': 'menu',
    'aria-expanded': open,
    'aria-controls': menuId,
  };

  return (
    <>
      {trigger ? (
        trigger(triggerProps)
      ) : (
        <button {...triggerProps} type="button" className={`icon-button ${className}`} aria-label={label}>
          <MoreHorizontal size={17} />
        </button>
      )}
      <Popover open={open} onClose={close} anchorRef={triggerRef} id={menuId} label={label} role="menu" placement={placement} className="menu-panel">
        {() => <MenuBody entries={entries} activeId={activeId} setActiveId={setActiveId} onSelect={select} itemRefs={itemRefs} />}
      </Popover>
    </>
  );
}
