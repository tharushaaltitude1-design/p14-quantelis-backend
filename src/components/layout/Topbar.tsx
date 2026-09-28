import { useCallback, useState } from 'react';
import { ChevronDown, LogOut, Menu as MenuIcon, Plus, Search, Settings, ShieldCheck, User } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { pageMeta } from './pageMeta';
import { NotificationsMenu } from './NotificationsMenu';
import { GlobalSearch } from './GlobalSearch';
import { Menu, type MenuEntry } from '@/components/ui/Menu';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useCommandHotkey } from '@/hooks/useCommandHotkey';
import { useWorkspace, useWorkspaceDispatch } from '@/state/workspaceContext';
import { useAuth } from '@/state/authContext';
import { ROUTES } from '@/config/constants';

export function Topbar({ onOpenNav }: { onOpenNav: () => void }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const dispatch = useWorkspaceDispatch();
  const { profile } = useWorkspace();
  const { signOut, user } = useAuth();
  const [searchOpen, setSearchOpen] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const page = pageMeta(pathname);
  const showNewProject = pathname === '/' || pathname === '/projects';
  const toggleSearch = useCallback(() => setSearchOpen((value) => !value), []);
  useCommandHotkey(toggleSearch);

  // The Firebase account is the source of truth for identity; the workspace store keeps the
  // richer profile fields (role, department) that Firebase Auth does not model.
  const displayName = user?.displayName || profile.fullName;
  const initials = user?.displayName
    ? user.displayName
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join('')
    : profile.initials;

  const performSignOut = useCallback(async () => {
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

  const accountEntries: MenuEntry[] = [
    { id: 'profile', label: 'Your profile', icon: User, onSelect: () => navigate('/profile') },
    { id: 'settings', label: 'Workspace settings', icon: Settings, onSelect: () => navigate('/settings') },
    { id: 'security', label: 'Security', icon: ShieldCheck, onSelect: () => navigate('/security') },
    { id: 'account-separator', kind: 'separator' },
    { id: 'signout', label: 'Sign out', icon: LogOut, danger: true, onSelect: () => setConfirmSignOut(true) },
  ];

  return (
    <header className="topbar">
      <button className="icon-button mobile-menu" onClick={onOpenNav} aria-label="Open navigation">
        <MenuIcon size={20} />
      </button>
      <div className="topbar-heading">
        <span className="eyebrow">WORKSPACE / QUANTELIS</span>
        <h1>{page.title}</h1>
        <p>{page.subtitle}</p>
      </div>
      <div className="topbar-actions">
        <button
          type="button"
          className="search-box search-trigger hide-mobile"
          onClick={() => setSearchOpen(true)}
          aria-label="Search workspace"
          aria-haspopup="dialog"
        >
          <Search size={16} aria-hidden="true" />
          <span className="search-trigger-label">Search workspace</span>
          <kbd>⌘ K</kbd>
        </button>
        <button type="button" className="icon-button search-trigger-icon" onClick={() => setSearchOpen(true)} aria-label="Search workspace">
          <Search size={19} />
        </button>
        <NotificationsMenu onNavigate={navigate} />
        {showNewProject && (
          <button className="primary-button hide-mobile" onClick={() => navigate('/projects?new=true')}>
            <Plus size={17} /> New project
          </button>
        )}
        <Menu
          label="Account menu"
          placement="bottom-end"
          entries={accountEntries}
          trigger={(props) => (
            <button {...props} type="button" className="profile-mini" aria-label="Open account menu">
              <span className="avatar avatar-small" title={displayName}>
                {initials}
              </span>
              <ChevronDown size={14} />
            </button>
          )}
        />
      </div>
      {searchOpen && <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />}
      {confirmSignOut && (
        <ConfirmDialog
          title="Sign out of Quantelis?"
          message="You will need to sign in again to reach this workspace. Unsaved changes on this page will be lost."
          confirmLabel="Sign out"
          onCancel={() => setConfirmSignOut(false)}
          onConfirm={() => {
            setConfirmSignOut(false);
            void performSignOut();
          }}
        />
      )}
    </header>
  );
}
