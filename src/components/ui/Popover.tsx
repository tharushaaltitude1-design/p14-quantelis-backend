import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { positionPanel, type MenuPlacement } from '@/lib/menuPosition';
import { useEscapeKey } from '@/hooks/useEscapeKey';

type PopoverProps = {
  open: boolean;
  onClose: () => void;
  /** Element the panel is anchored to. */
  anchorRef: React.RefObject<HTMLElement>;
  label: string;
  /** Id applied to the panel, so a trigger can point `aria-controls` at it. */
  id?: string;
  role?: 'menu' | 'dialog';
  placement?: MenuPlacement;
  className?: string;
  children: (panelRef: React.RefObject<HTMLDivElement>) => ReactNode;
};

/**
 * Portal + viewport-aware positioning + outside-press and Escape dismissal, shared by every
 * floating surface (menus, filter popovers, the notifications panel). Because the panel is
 * portalled to `document.body` it can never be clipped by an `overflow: hidden` ancestor such
 * as `.table-wrap` or a card.
 */
export function Popover({ open, onClose, anchorRef, label, id, role = 'menu', placement = 'bottom-end', className = '', children }: PopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<{ top: number; left: number; maxHeight: number } | null>(null);

  const reposition = useCallback(() => {
    const anchor = anchorRef.current;
    const panel = panelRef.current;
    if (!anchor || !panel) return;
    const next = positionPanel(anchor.getBoundingClientRect(), { width: panel.offsetWidth, height: panel.offsetHeight }, placement, {
      width: window.innerWidth,
      height: window.innerHeight,
    });
    setStyle((current) => (current && current.top === next.top && current.left === next.left && current.maxHeight === next.maxHeight ? current : next));
  }, [anchorRef, placement]);

  useLayoutEffect(() => {
    if (!open) {
      setStyle(null);
      return;
    }
    reposition();
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [open, reposition]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      // The contains-check on the anchor is what stops the press that opened the panel
      // from immediately dismissing it again.
      if (anchorRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [open, anchorRef, onClose]);

  useEscapeKey(open, onClose);

  if (!open) return null;

  return createPortal(
    <div
      ref={panelRef}
      id={id}
      role={role}
      aria-label={label}
      // `popover-panel` carries the positioning primitives; call sites only add their own
      // surface class, so a panel can never end up unpositioned in the document flow.
      className={`popover-panel ${className} ${placement.endsWith('end') ? 'align-end' : 'align-start'}`.trim()}
      style={style ? { top: style.top, left: style.left, maxHeight: style.maxHeight } : { visibility: 'hidden' }}
    >
      {children(panelRef)}
    </div>,
    document.body,
  );
}
