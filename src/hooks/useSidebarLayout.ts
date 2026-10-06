import { useCallback, useEffect, useState } from 'react';
import { useSidebarIsDrawer } from './useMediaQuery';

const STORAGE_KEY = 'quantelis.nav.collapsed';

/**
 * Reads the stored preference defensively: storage can hold anything, be unavailable in
 * private mode, or throw outright in a sandboxed iframe.
 */
function readStored(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Sidebar layout state, covering both of the sidebar's two jobs.
 *
 * Wide (>= 992px): the sidebar is a permanent rail, and "collapsed" means narrow — icons only,
 * no labels, so a dashboard parked on a laptop screen gives the data back some width. The choice
 * is persisted, because it is a working preference rather than something to reset on reload.
 *
 * Narrow (< 992px): the sidebar is an overlay drawer that starts closed, and collapsing it does
 * not apply. Both are surfaced as one `toggle` so the header carries a single button that does
 * the obvious thing at whatever width it is rendered at.
 */
export function useSidebarLayout() {
  const isDrawer = useSidebarIsDrawer();
  const [collapsed, setCollapsed] = useState(readStored);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Growing the window past the breakpoint reveals a rail. Leaving `drawerOpen` set would then
  // mean the rail renders as permanently open with no way to close it, so the two states are
  // kept from bleeding into each other.
  useEffect(() => {
    if (!isDrawer) setDrawerOpen(false);
  }, [isDrawer]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(collapsed));
    } catch {
      // Nothing to do: the preference simply will not survive a reload.
    }
  }, [collapsed]);

  const toggle = useCallback(() => {
    if (isDrawer) {
      setDrawerOpen((value) => !value);
      return;
    }
    setCollapsed((value) => !value);
  }, [isDrawer]);

  return {
    isDrawer,
    collapsed,
    drawerOpen,
    toggle,
    /** Narrowing the sidebar is only meaningful where it is a rail. */
    canCollapse: !isDrawer,
    closeDrawer: useCallback(() => setDrawerOpen(false), []),
    /** Direct setter, so the drawer can be dismissed by its own close affordances. */
    setDrawerOpen,
  };
}

export type SidebarLayout = ReturnType<typeof useSidebarLayout>;