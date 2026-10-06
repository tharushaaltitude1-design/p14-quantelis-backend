import { useCallback, useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { BookOpen, Building2, Check, ChevronDown, ChevronRight, CircleHelp, LogOut, PanelLeftClose, PanelLeftOpen, Settings, ShieldCheck, User } from 'lucide-react';
import { NAV_GENERAL, NAV_PRIMARY, type NavItem } from '@/config/nav';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { useScrollLock } from '@/hooks/useScrollLock';
import type { SidebarLayout } from '@/hooks/useSidebarLayout';
import { Popover } from '@/components/ui/Popover';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useWorkspace, useWorkspaceDispatch } from '@/state/workspaceContext';
import { useAuth } from '@/state/authContext';
import { Avatar } from '@/components/ui/Avatar';
import { Logo } from '@/components/brand/Logo';
import { initialsFor } from '@/lib/initials';
import { COMPANY, ROUTES } from '@/config/constants';

const WORKSPACES = [
  { id: 'quantelis-labs', name: 'Quantelis Labs', kind: 'Team workspace', initial: 'Q' },
  { id: 'field-ops', name: 'Field Operations', kind: 'Team workspace', initial: 'F' },
  { id: 'research', name: 'Research Sandbox', kind: 'Personal', initial: 'R' },
];

/**
 * `compact` hides the label to leave an icon-only rail. The label stays in the DOM and in the
 * accessible name either way; it is only visually removed, so the link keeps its name and a
 * screen-reader user is unaffected. `title` is added in compact mode because the text is no
 * longer visible to hover for a sighted mouse user.
 */
function SidebarNavItem({ item, onNavigate, compact }: { item: NavItem; onNavigate: () => void; compact: boolean }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      onClick={onNavigate}
      className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
      title={compact ? item.label : undefined}
    >
      <Icon size={17} aria-hidden="true" />
      <span className="nav-item-label">{item.label}</span>
      {item.dot && <span className="nav-dot" />}
    </NavLink>
  );
}

function WorkspaceSwitcher() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(WORKSPACES[0]);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { projects, datasets, scenarios } = useWorkspace();
  const dispatch = useWorkspaceDispatch();

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="workspace-switch"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Workspace: ${active.name}. Change workspace`}
      >
        <span className="workspace-icon">{active.initial}</span>
        <span className="workspace-name">
          <b>{active.name}</b>
          <small>{active.kind}</small>
        </span>
        <ChevronDown size={14} />
      </button>
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={triggerRef} label="Switch workspace" role="menu" placement="bottom-start" className="menu-panel">
        {() => (
          <>
            <span className="menu-label">Workspaces</span>
            {WORKSPACES.map((workspace) => (
              <button
                key={workspace.id}
                type="button"
                role="menuitemradio"
                aria-checked={active.id === workspace.id}
                className="menu-item"
                onClick={() => {
                  setActive(workspace);
                  setOpen(false);
                  triggerRef.current?.focus();
                  if (workspace.id !== 'quantelis-labs') navigate(ROUTES.overview);
                  dispatch({ type: 'toast/push', toast: { kind: 'info', title: `Switched to ${workspace.name}`, message: workspace.id === 'quantelis-labs' ? 'Live workspace data is shown below.' : 'This build only holds data for Quantelis Labs — other workspaces are placeholders.' } });
                }}
              >
                <Building2 size={15} />
                <span className="menu-item-label">{workspace.name}</span>
                {active.id === workspace.id && (
                  <span className="menu-check">
                    <Check size={14} />
                  </span>
                )}
              </button>
            ))}
            <div className="menu-separator" role="separator" />
            <button
              type="button"
              role="menuitem"
              className="menu-item"
              onClick={() => {
                setOpen(false);
                dispatch({ type: 'settings/update', changes: { name: active.name } });
                dispatch({ type: 'toast/push', toast: { kind: 'success', title: 'Workspace renamed', message: `Workspace name set to “${active.name}”.` } });
              }}
            >
              <Settings size={15} />
              <span className="menu-item-label">Rename “{active.name}”</span>
            </button>
            <span className="menu-item workspace-stats">
              <span className="menu-item-label">
                {projects.length} projects · {datasets.length} datasets · {scenarios.length} scenarios
              </span>
            </span>
          </>
        )}
      </Popover>
    </>
  );
}

export function Sidebar({ layout, onClose }: { layout: SidebarLayout; onClose: () => void }) {
  const navigate = useNavigate();
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userTriggerRef = useRef<HTMLButtonElement>(null);
  const { profile } = useWorkspace();
  const dispatch = useWorkspaceDispatch();
  const { signOut, user } = useAuth();

  // The drawer state is the live one here. `onClose` is passed separately so the two dismissal
  // paths — this component's own close control and the backdrop — cannot drift.
  const mobileOpen = layout.isDrawer && layout.drawerOpen;
  const compact = layout.collapsed && !layout.isDrawer;

  // One control for the whole sidebar, living on the sidebar's own edge rather than in the header.
  // Wide, it collapses the rail so the tables get the width back; narrow, the sidebar is an
  // overlay drawer and the same button opens and closes it. A control in the header would have had
  // to be hidden or disabled at one width or the other to avoid being a duplicate.
  const sidebarLabel = layout.isDrawer
    ? mobileOpen
      ? 'Close navigation'
      : 'Open navigation'
    : compact
      ? 'Expand sidebar'
      : 'Collapse sidebar';
  const sidebarExpanded = layout.isDrawer ? mobileOpen : !compact;

  // Prefer the live Firebase account for name/photo so a Google avatar appears on first paint,
  // rather than waiting for `useProfileSync` to write it into the store.
  const chipName = user?.displayName || profile.fullName;
  const chipInitials = user?.displayName ? initialsFor(user.displayName) : profile.initials;

  const signOutUser = useCallback(async () => {
    try {
      await signOut();
      dispatch({ type: 'toast/push', toast: { kind: 'success', title: 'Signed out', message: 'Your session has ended.' } });
      navigate(ROUTES.login, { replace: true });
    } catch (error) {
      dispatch({
        type: 'toast/push',
        toast: { kind: 'danger', title: 'Could not sign out', message: error instanceof Error ? error.message : 'Please try again.' },
      });
    }
  }, [signOut, dispatch, navigate]);

  useEscapeKey(mobileOpen, onClose);
  // Only the drawer needs the page behind it frozen; the collapsed rail is in the page flow and
  // scrolling must keep working when it is reduced to icons.
  useScrollLock(mobileOpen);
  useEffect(() => {
    document.body.dataset.navOpen = String(mobileOpen);
    return () => {
      delete document.body.dataset.navOpen;
    };
  }, [mobileOpen]);

  return (
    <>
      {/* The backdrop is a pointer convenience for dismissing the drawer by clicking away from
          it. It is hidden from assistive tech on purpose: the drawer carries its own close button
          and Escape already covers the keyboard, so announcing this would offer a third control
          with the same name and no extra capability. */}
      {mobileOpen && (
        <button className="sidebar-backdrop" onClick={onClose} tabIndex={-1} aria-hidden="true" />
      )}
      {/* Straddling the sidebar's edge, the way a collapsed panel's handle is expected to sit, so
          it stays reachable whether the rail is 264px or 72px wide — and, as a sibling of the
          `<aside>` rather than a child of it, it is still on screen when the closed drawer has
          been translated off the left edge. */}
      <button
        type="button"
        className="sidebar-handle"
        onClick={layout.isDrawer && mobileOpen ? onClose : layout.toggle}
        aria-label={sidebarLabel}
        aria-expanded={sidebarExpanded}
        aria-controls="app-sidebar"
      >
        {sidebarExpanded ? <PanelLeftClose size={15} aria-hidden="true" /> : <PanelLeftOpen size={15} aria-hidden="true" />}
      </button>
      <aside
        className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}
        id="app-sidebar"
        data-compact={compact ? 'true' : 'false'}
      >
        <div className="sidebar-brand">
          {/* Points at the marketing site rather than the dashboard, so a click on the wordmark
              does not navigate away from the app. A plain anchor, not a router <Link>, because
              this leaves the SPA entirely. */}
          <a
            className="sidebar-brand-link"
            href={COMPANY.siteUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Quantelis website (opens in a new tab)"
          >
            <Logo className="sidebar-logo" />
          </a>
        </div>
        <WorkspaceSwitcher />
        <nav aria-label="Primary">
          <span className="nav-label">Workspace</span>
          {NAV_PRIMARY.map((item) => (
            <SidebarNavItem key={item.to} item={item} onNavigate={onClose} compact={compact} />
          ))}
          <span className="nav-label nav-label-spaced">General</span>
          {NAV_GENERAL.map((item) => (
            <SidebarNavItem key={item.to} item={item} onNavigate={onClose} compact={compact} />
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button
            type="button"
            className="help-card"
            onClick={() => {
              dispatch({ type: 'toast/push', toast: { kind: 'info', title: 'Quantelis guide', message: 'Documentation is not bundled with this build.' } });
            }}
          >
            <span className="help-icon">
              <CircleHelp size={16} />
            </span>
            <span>
              <b>Need a hand?</b>
              <span>Explore the Quantelis guide</span>
            </span>
            <BookOpen size={15} />
          </button>
          <button
            ref={userTriggerRef}
            type="button"
            className="user-chip"
            onClick={() => setUserMenuOpen((value) => !value)}
            aria-haspopup="menu"
            aria-expanded={userMenuOpen}
            aria-label={`Account menu for ${chipName}`}
          >
            <Avatar
              name={chipName}
              initials={chipInitials}
              src={user?.photoURL ?? profile.photoURL}
            />
            <span>
              <b>{chipName}</b>
              <small>{profile.jobRole}</small>
            </span>
            <ChevronRight size={16} className="user-chip-chevron" />
          </button>
        </div>
      </aside>
      <Popover open={userMenuOpen} onClose={() => setUserMenuOpen(false)} anchorRef={userTriggerRef} label="Account menu" role="menu" placement="top-start" className="menu-panel">
        {() => (
          <>
            <span className="menu-label">{profile.email}</span>
            <button
              type="button"
              role="menuitem"
              className="menu-item"
              onClick={() => {
                setUserMenuOpen(false);
                navigate(ROUTES.profile);
              }}
            >
              <User size={15} />
              <span className="menu-item-label">View profile</span>
            </button>
            <button
              type="button"
              role="menuitem"
              className="menu-item"
              onClick={() => {
                setUserMenuOpen(false);
                navigate(ROUTES.settings);
              }}
            >
              <Settings size={15} />
              <span className="menu-item-label">Workspace settings</span>
            </button>
            <button
              type="button"
              role="menuitem"
              className="menu-item"
              onClick={() => {
                setUserMenuOpen(false);
                navigate(ROUTES.security);
              }}
            >
              <ShieldCheck size={15} />
              <span className="menu-item-label">Security</span>
            </button>
            <div className="menu-separator" role="separator" />
            <button
              type="button"
              role="menuitem"
              className="menu-item danger"
              onClick={() => {
                setUserMenuOpen(false);
                setConfirmSignOut(true);
              }}
            >
              <LogOut size={15} />
              <span className="menu-item-label">Sign out</span>
            </button>
          </>
        )}
      </Popover>
      {confirmSignOut && (
        <ConfirmDialog
          title="Sign out of Quantelis?"
          message="You will need to sign in again to reach this workspace."
          confirmLabel="Sign out"
          onCancel={() => setConfirmSignOut(false)}
          onConfirm={() => {
            setConfirmSignOut(false);
            void signOutUser();
          }}
        />
      )}
    </>
  );
}
