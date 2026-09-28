import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/state/authContext';
import { PageSkeleton } from '@/components/ui/PageSkeleton';

/**
 * Route guard for the authenticated dashboard.
 *
 * Waits for Firebase to report a session before deciding, otherwise a page refresh would
 * bounce a signed-in user to the sign-in screen for a frame. The attempted path is carried in
 * router state so sign-in can return the user to where they were headed.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <PageSkeleton />;
  if (status === 'unauthenticated') return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return <>{children}</>;
}

/** Keeps a signed-in user away from the sign-in / sign-up screens. */
export function RedirectIfAuthenticated({ children }: { children: ReactNode }) {
  const { status } = useAuth();

  if (status === 'loading') return <PageSkeleton />;
  if (status === 'authenticated') return <Navigate to="/" replace />;
  return <>{children}</>;
}
