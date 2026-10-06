import { useEffect, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useProfileSync } from '@/hooks/useProfileSync';
import { useSidebarLayout } from '@/hooks/useSidebarLayout';
import { useWorkspace, useWorkspaceDispatch } from '@/state/workspaceContext';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { pageMeta } from './pageMeta';

export function AppShell({ children }: { children: ReactNode }) {
  const sidebar = useSidebarLayout();
  const { pathname } = useLocation();
  useDocumentTitle(pageMeta(pathname).title);
  useProfileSync();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return (
    // Drives the collapsed rail. An attribute rather than a class so the stylesheets can key off it
    // without depending on a selector that has to stay in step with the component's markup.
    <div className="app-shell" data-sidebar={sidebar.collapsed ? 'collapsed' : 'expanded'}>
      <Sidebar layout={sidebar} onClose={sidebar.closeDrawer} />
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <main className="main-content" id="main-content" tabIndex={-1}>
        <Topbar />
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