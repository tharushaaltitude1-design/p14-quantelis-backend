export type MenuPlacement = 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end';

export type PanelPosition = { top: number; left: number; maxHeight: number };

const GAP = 6;
const MARGIN = 8;

type Size = { width: number; height: number };

/**
 * Places a floating panel next to its anchor, flipping above the anchor when there is not
 * enough room below and clamping horizontally so the panel never leaves the viewport.
 * All menus/popovers are rendered through a portal, so this runs against window coordinates.
 */
export function positionPanel(
  anchor: DOMRect,
  panel: Size,
  placement: MenuPlacement,
  viewport: { width: number; height: number },
): PanelPosition {
  const { width, height } = viewport;
  const fitsBelow = anchor.bottom + GAP + panel.height <= height - MARGIN;
  const placeAbove = placement.startsWith('top') || !fitsBelow;
  const top = placeAbove ? anchor.top - GAP - panel.height : anchor.bottom + GAP;

  const alignEnd = placement.endsWith('end');
  const preferredLeft = alignEnd ? anchor.right - panel.width : anchor.left;
  const left = clamp(preferredLeft, MARGIN, Math.max(MARGIN, width - panel.width - MARGIN));

  // Never grow past the space actually available on the chosen side.
  const available = placeAbove ? anchor.top - GAP - MARGIN : height - anchor.bottom - GAP - MARGIN;
  const maxHeight = Math.max(140, Math.min(panel.height, available));

  return {
    top: Math.max(MARGIN, placeAbove ? top : Math.min(top, height - maxHeight - MARGIN)),
    left,
    maxHeight,
  };
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
}
