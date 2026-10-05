import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/state/authContext';
import { useWorkspace } from '@/state/workspaceContext';
import { PageSkeleton } from '@/components/ui/PageSkeleton';
import { takeReturnTo } from '@/lib/authReturn';
import { GUEST_ROUTES, ROUTES } from '@/config/constants';

/**
 * Route guard for the authenticated dashboard.
 *
 * Waits for Firebase to report a session before deciding, otherwise a page refresh would
 * bounce a signed-in user to the sign-in screen for a frame. The attempted path is carried in
 * router state so sign-in can return the user to where they were headed.
 *
 * It then waits for the workspace store to finish its first round of snapshots. Rendering the
 * dashboard against the seeded fixtures and replacing them a moment later would show data that
 * is not this account's, and would let a user start editing rows that are about to vanish.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();
  const { hydrated } = useWorkspace();

  if (status === 'loading') return <PageSkeleton />;
  if (status === 'unauthenticated') return <Navigate to={ROUTES.login} replace state={{ from: location.pathname + location.search }} />;
  if (!hydrated) return <PageSkeleton />;
  return <>{children}</>;
}

/**
 * Keeps a signed-in user away from the sign-in / sign-up screens and lands them on the dashboard.
 *
 * The destination is normally the Overview, which is the product's default landing page. The one
 * exception is a deep link captured by {@link RequireAuth}: that target was stashed in
 * `sessionStorage` before a Google redirect tore the page down, and it is consumed on read so a
 * later sign-in cannot reuse it. Guarding a guest route is needed as well — a signed-in visitor
 * who bookmarked `/login` should not be bounced to a sign-in form and back around in a loop.
 */
export function RedirectIfAuthenticated({ children }: { children: ReactNode }) {
  const { status } = useAuth();

  if (status === 'loading') return <PageSkeleton />;
  if (status === 'authenticated') {
    const target = takeReturnTo(ROUTES.overview);
    return <Navigate to={GUEST_ROUTES.includes(target) ? ROUTES.overview : target} replace />;
  }
  return <>{children}</>;
}
