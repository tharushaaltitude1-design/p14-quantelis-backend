import { useEffect, useState } from 'react';

/**
 * Tracks a CSS media query from React.
 *
 * The sidebar behaves two different ways depending on width — a permanent rail that can be
 * collapsed, and a drawer that has to be opened — and the toggle button in the header has to
 * act on whichever one is currently in play. CSS can hide the button at the wrong width, but it
 * cannot tell the component which behaviour is live, so the query is mirrored here.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(query).matches,
  );

  useEffect(() => {
    const list = window.matchMedia(query);
    // Re-read on mount: the query may have changed between the lazy initial state above and this
    // effect running, which happens when the viewport is resized before hydration finishes.
    setMatches(list.matches);
    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/**
 * The width below which the sidebar stops being a rail and becomes an overlay drawer.
 *
 * Must stay in step with the `max-width: 991px` breakpoint in `src/styles/responsive.css`; the
 * two are asserted against each other in `sidebarLayout.test.ts`.
 */
export const DRAWER_BREAKPOINT = '(max-width: 991px)';

/** True when the sidebar is an overlay drawer rather than a rail in the page flow. */
export function useSidebarIsDrawer(): boolean {
  return useMediaQuery(DRAWER_BREAKPOINT);
}