import { useEffect, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useProfileSync } from '@/hooks/useProfileSync';
import { useWorkspace, useWorkspaceDispatch } from '@/state/workspaceContext';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { pageMeta } from './pageMeta';

export function AppShell({ children }: { children: ReactNode }) {
  const [navOpen, setNavOpen] = useState(false);
  const { pathname } = useLocation();
  useDocumentTitle(pageMeta(pathname).title);
  useProfileSync();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return (
    <div className="app-shell">
      <Sidebar mobileOpen={navOpen} onClose={() => setNavOpen(false)} />
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <main className="main-content" id="main-content" tabIndex={-1}>
        <Topbar onOpenNav={() => setNavOpen(true)} />
        <SyncErrorBanner />
        {children}
      </main>
    </div>
  );
}

/**
 * Persistent banner for a failed Firestore write or an unreachable database.
 *
 * Optimistic writes roll themselves back and raise a toast, but a toast disappears after a few
 * seconds and an offline tab can fail silently for a long time. This keeps the condition visible
 * until the next write succeeds.
 */
function SyncErrorBanner() {
  const { syncError } = useWorkspace();
  const dispatch = useWorkspaceDispatch();

  if (!syncError) return null;

  return (
    <div className="sync-banner" role="alert">
      <AlertTriangle size={16} aria-hidden="true" />
      <span>
        <b>Not saving to the database.</b> {syncError}
      </span>
      <button type="button" className="text-button" onClick={() => dispatch({ type: 'workspace/syncError', message: null })}>
        Dismiss
      </button>
    </div>
  );
}