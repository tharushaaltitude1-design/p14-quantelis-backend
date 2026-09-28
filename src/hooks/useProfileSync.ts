import { useEffect } from 'react';
import { useWorkspaceDispatch } from '@/state/workspaceContext';
import { useAuth } from '@/state/authContext';

/**
 * Mirrors the signed-in Firebase identity into the workspace store.
 *
 * Firebase Auth owns identity (display name, email, photo); the store owns the richer profile
 * fields Auth does not model (job role, department). Both the header avatar and the sidebar
 * read from the store, so this keeps every surface showing the same person after a sign-in.
 */
export function useProfileSync(): void {
  const { user, profileVersion } = useAuth();
  const dispatch = useWorkspaceDispatch();

  useEffect(() => {
    if (!user) return;
    const displayName = user.displayName?.trim();
    const initials =
      displayName
        ?.split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join('') || undefined;

    dispatch({
      type: 'profile/syncIdentity',
      identity: {
        ...(displayName ? { fullName: displayName } : {}),
        ...(user.email ? { email: user.email } : {}),
        ...(initials ? { initials } : {}),
      },
    });
  }, [user, profileVersion, dispatch]);
}
