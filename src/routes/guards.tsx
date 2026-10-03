import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/state/authContext';
import { useWorkspace } from '@/state/workspaceContext';
import { PageSkeleton } from '@/components/ui/PageSkeleton';

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
  if (status === 'unauthenticated') return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (!hydrated) return <PageSkeleton />;
  return <>{children}</>;
}

/** Keeps a signed-in user away from the sign-in / sign-up screens. */
export function RedirectIfAuthenticated({ children }: { children: ReactNode }) {
  const { status } = useAuth();

  if (status === 'loading') return <PageSkeleton />;
  if (status === 'authenticated') return <Navigate to="/" replace />;
  return <>{children}</>;
}
