import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AppShell } from '../AppShell';
import { WorkspaceProvider } from '@/state/WorkspaceProvider';
import { AuthTestProvider } from '@/test/authTestUtils';
import { makeAuthValue } from '@/test/authFixtures';
import { DRAWER_BREAKPOINT } from '@/hooks/useMediaQuery';

const layoutCss = readFileSync(resolve(process.cwd(), 'src/styles/layout.css'), 'utf8');
const responsiveCss = readFileSync(resolve(process.cwd(), 'src/styles/responsive.css'), 'utf8');

/**
 * The shell reads one media query to decide whether the sidebar is a rail or a drawer. jsdom has
 * no layout engine, so `matchMedia` is stubbed per test rather than the width being emulated.
 */
function stubViewport(isDrawer: boolean) {
  const listeners = new Set<() => void>();
  const list = {
    get matches() {
      return isDrawer;
    },
    media: DRAWER_BREAKPOINT,
    addEventListener: (_: string, cb: () => void) => listeners.add(cb),
    removeEventListener: (_: string, cb: () => void) => listeners.delete(cb),
    addListener: (cb: () => void) => listeners.add(cb),
    removeListener: (cb: () => void) => listeners.delete(cb),
    dispatchEvent: () => true,
    onchange: null,
  } as unknown as MediaQueryList;
  window.matchMedia = vi.fn().mockImplementation((query: string) => {
    // Any other query in the tree is expected to be false in these tests.
    if (query === DRAWER_BREAKPOINT) return list;
    return { ...list, matches: false, media: query } as unknown as MediaQueryList;
  }) as typeof window.matchMedia;
  return () => {
    listeners.forEach((cb) => cb());
  };
}

function renderShell() {
  // Both destinations sit under the shell so navigating does not unmount it — the real app keeps
  // the shell mounted across route changes, and the drawer test is about what happens to the
  // sidebar as the route changes, not about what survives an unmount.
  return render(
    <MemoryRouter initialEntries={['/']}>
      <AuthTestProvider value={makeAuthValue()}>
        <WorkspaceProvider>
          <AppShell>
            <Routes>
              <Route path="/" element={<h1>Overview</h1>} />
              <Route path="/datasets" element={<h1>Datasets</h1>} />
            </Routes>
          </AppShell>
        </WorkspaceProvider>
      </AuthTestProvider>
    </MemoryRouter>,
  );
}

/** The single sidebar control. There is exactly one, so it can be queried by name. */
const control = () => screen.getByRole('button', { name: /^(collapse|expand) sidebar$|^(open|close) navigation$/i });
const shell = () => document.querySelector('.app-shell') as HTMLElement;
const sidebar = () => document.getElementById('app-sidebar') as HTMLElement;

describe('the sidebar collapse control', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.body.removeAttribute('data-nav-open');
  });

  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('exists exactly once in the app', async () => {
    stubViewport(false);
    renderShell();
    // A second copy would mean two buttons that can disagree about the same state. Both the
    // header's old toggle and the rail's inline copy were removed in favour of this one.
    expect(document.querySelectorAll('.sidebar-handle')).toHaveLength(1);
    expect(document.querySelector('.sidebar-toggle')).toBeNull();
    expect(document.querySelector('.sidebar-collapse')).toBeNull();
  });

  it('lives on the sidebar rather than in the header', async () => {
    stubViewport(false);
    renderShell();
    expect(document.querySelector('header.topbar')).not.toContainElement(control());
  });

  describe('as a rail (992px and up)', () => {
    it('collapses and expands, and reports which it did', async () => {
      stubViewport(false);
      const user = userEvent.setup();
      renderShell();

      expect(shell().dataset.sidebar).toBe('expanded');
      // `aria-expanded` here means "is the sidebar showing", not "what will the button do".
      expect(control()).toHaveAttribute('aria-expanded', 'true');
      expect(control()).toHaveAccessibleName('Collapse sidebar');

      await user.click(control());
      expect(shell().dataset.sidebar).toBe('collapsed');
      expect(control()).toHaveAttribute('aria-expanded', 'false');
      expect(control()).toHaveAccessibleName('Expand sidebar');

      await user.click(control());
      expect(shell().dataset.sidebar).toBe('expanded');
      expect(control()).toHaveAccessibleName('Collapse sidebar');
    });

    it('keeps the collapsed choice across a reload', async () => {
      stubViewport(false);
      const user = userEvent.setup();
      const first = renderShell();
      await user.click(control());
      first.unmount();

      renderShell();
      expect(shell().dataset.sidebar).toBe('collapsed');
    });

    it('marks the sidebar compact only while it is collapsed', async () => {
      stubViewport(false);
      const user = userEvent.setup();
      renderShell();
      expect(sidebar().dataset.compact).toBe('false');
      await user.click(control());
      expect(sidebar().dataset.compact).toBe('true');
    });

    it('points at the sidebar it acts on', async () => {
      stubViewport(false);
      renderShell();
      expect(control()).toHaveAttribute('aria-controls', 'app-sidebar');
      expect(sidebar()).toBeInTheDocument();
    });

    // The labels are hidden with `display:none` on the span only, so the links keep their text in
    // the accessibility tree. Hiding the whole item would leave an unlabelled icon-only link.
    it('leaves every nav link with an accessible name when collapsed', async () => {
      stubViewport(false);
      const user = userEvent.setup();
      renderShell();
      await user.click(control());

      const links = screen.getAllByRole('link');
      expect(links.length).toBeGreaterThan(3);
      for (const link of links) {
        expect(link).toHaveAccessibleName(/\S/);
      }
      // And a `title`, because the text is no longer visible for a sighted mouse user.
      expect(screen.getByRole('link', { name: 'Datasets' })).toHaveAttribute('title', 'Datasets');
    });
  });

  describe('as a drawer (991px and below)', () => {
    it('opens and closes from the same single control', async () => {
      stubViewport(true);
      const user = userEvent.setup();
      renderShell();

      expect(control()).toHaveAttribute('aria-expanded', 'false');
      expect(control()).toHaveAccessibleName('Open navigation');
      expect(document.body.dataset.navOpen).toBe('false');

      await user.click(control());
      expect(document.body.dataset.navOpen).toBe('true');
      expect(control()).toHaveAccessibleName('Close navigation');

      await user.click(control());
      expect(document.body.dataset.navOpen).toBe('false');
      expect(control()).toHaveAccessibleName('Open navigation');
    });

    // "Collapse" is meaningless for an overlay: there is no rail to narrow, so offering it would
    // imply a state that cannot happen.
    it('never offers to collapse the drawer', async () => {
      stubViewport(true);
      const user = userEvent.setup();
      renderShell();
      await user.click(control());
      expect(screen.queryByRole('button', { name: /collapse sidebar/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /expand sidebar/i })).not.toBeInTheDocument();
    });

    it('keeps a stored collapsed preference out of the drawer', async () => {
      window.localStorage.setItem('quantelis.nav.collapsed', 'true');
      stubViewport(true);
      const user = userEvent.setup();
      renderShell();
      await user.click(control());
      // A rail preference must not turn the overlay into a 72px sliver.
      expect(sidebar()).toHaveAttribute('data-compact', 'false');
    });

    it('closes on Escape', async () => {
      stubViewport(true);
      const user = userEvent.setup();
      renderShell();
      await user.click(control());
      await user.keyboard('{Escape}');
      expect(document.body.dataset.navOpen).toBe('false');
    });

    it('closes when a nav destination is chosen', async () => {
      stubViewport(true);
      const user = userEvent.setup();
      renderShell();
      await user.click(control());
      await user.click(screen.getByRole('link', { name: 'Datasets' }));
      await waitFor(() => expect(document.body.dataset.navOpen).toBe('false'));
    });

    // The backdrop covers the page to dismiss the drawer by clicking away, but it duplicates the
    // control and Escape. Announcing it would put three identically named controls in the tree
    // for what is one capability.
    it('keeps the backdrop out of the accessibility tree', async () => {
      stubViewport(true);
      const user = userEvent.setup();
      renderShell();
      await user.click(control());

      const backdrop = document.querySelector('.sidebar-backdrop') as HTMLButtonElement;
      expect(backdrop).toHaveAttribute('aria-hidden', 'true');
      expect(backdrop).toHaveAttribute('tabindex', '-1');
      expect(screen.getAllByRole('button', { name: 'Close navigation' })).toHaveLength(1);
    });
  });

  describe('the stylesheet', () => {
    // The CSS and the JS query decide the same thing by hand. If they drift, the control collapses
    // a rail that has become a drawer, or offers a collapse that does nothing.
    it('uses the same breakpoint in CSS and in the query', () => {
      expect(DRAWER_BREAKPOINT).toBe('(max-width: 991px)');
      expect(responsiveCss).toMatch(/@media \(max-width: 991px\)/);
    });

    it('removes the hamburger and the header toggle entirely', () => {
      expect(layoutCss).not.toMatch(/\.mobile-menu/);
      expect(responsiveCss).not.toMatch(/\.mobile-menu/);
      expect(layoutCss).not.toMatch(/\.sidebar-toggle/);
      expect(layoutCss).not.toMatch(/\.sidebar-collapse/);
    });

    it('drives the rail width and the content offset from one custom property', () => {
      // Two hard-coded widths would let the rail and the content offset disagree.
      expect(layoutCss).toMatch(/--sidebar-width:\s*264px/);
      expect(layoutCss).toMatch(/\.sidebar \{[^}]*width: var\(--sidebar-width\)/s);
      expect(layoutCss).toMatch(/\.main-content \{[^}]*margin-left: var\(--sidebar-width\)/s);
    });

    it('reserves the collapsed width as a token so the two sizes cannot be mistyped apart', () => {
      expect(layoutCss).toMatch(/--sidebar-width-collapsed:\s*72px/);
      expect(layoutCss).toMatch(
        /data-sidebar='collapsed'\] \{ --sidebar-width: var\(--sidebar-width-collapsed\)/,
      );
    });

    // The handle is positioned from the same property as the rail, so it cannot drift off the
    // border when the rail changes width.
    it('positions the handle from the rail width rather than a literal', () => {
      expect(layoutCss).toMatch(/\.sidebar-handle \{[^}]*left: var\(--sidebar-width\)/s);
      expect(layoutCss).toMatch(/\.sidebar-handle \{[^}]*transition: left 0\.2s ease/s);
    });

    // A `:root` override inside the media query loses to the attribute selector above it, which
    // would let a stored preference shrink the drawer to 72px.
    it('overrides the collapsed width with a selector that out-specifies the attribute one', () => {
      const block = responsiveCss.slice(responsiveCss.indexOf('@media (max-width: 991px)'));
      expect(block).toMatch(/\.app-shell\[data-sidebar='collapsed'\] \{ --sidebar-width: 264px; \}/);
    });

    // With the drawer closed the sidebar is translated off screen, so a control inside it would
    // be unreachable. The handle is a sibling and is repositioned onto the viewport edge.
    it('moves the handle to the viewport edge while the drawer is closed', () => {
      expect(responsiveCss).toMatch(/\.sidebar-handle \{ left: 0;/);
      expect(responsiveCss).toMatch(/body\[data-nav-open='true'\] \.sidebar-handle \{ left: 264px;/);
    });

    it('does not reserve space in the header for a control that is no longer there', () => {
      expect(layoutCss).not.toMatch(/sidebar-toggle-spacer/);
    });

    it('collapses the sidebar to a single place in the DOM', () => {
      const source = readFileSync(resolve(process.cwd(), 'src/components/layout/AppShell.tsx'), 'utf8');
      expect(source).toMatch(/data-sidebar=\{sidebar\.collapsed \? 'collapsed' : 'expanded'\}/);
    });
  });
});