import { safeReturnTo } from '@/lib/redirect';

const STORAGE_KEY = 'quantelis.auth.returnTo';

/**
 * Remembers where a federated sign-in should land.
 *
 * The Google redirect fallback leaves the document entirely, so the `location.state.from` the
 * route guard stashed is gone by the time the user comes back — there is no in-memory router to
 * read it from. `sessionStorage` is the only store that survives the round trip while still
 * dying with the tab, which is the lifetime this value wants.
 *
 * Every write and every read runs through {@link safeReturnTo}. Storage is writable by any
 * script on the origin, so a hand-edited value must be treated exactly like a crafted `from`.
 */
export function rememberReturnTo(path: string): void {
  if (typeof window === 'undefined') return;
  const safe = safeReturnTo(path);
  try {
    window.sessionStorage.setItem(STORAGE_KEY, safe);
  } catch {
    // Private-mode Safari and some embedded browsers throw on any storage access. Losing the
    // deep link is survivable; failing the sign-in is not.
  }
}

/**
 * Reads and clears the stored destination, so a later sign-in does not reuse a stale one.
 * Falls back to `defaultPath` when nothing usable was stored.
 */
export function takeReturnTo(defaultPath: string): string {
  if (typeof window === 'undefined') return defaultPath;
  try {
    const stored = window.sessionStorage.getItem(STORAGE_KEY);
    if (!stored) return defaultPath;
    // Sanitise on the way out as well as on the way in: the value may have been written by
    // something other than {@link rememberReturnTo}.
    return safeReturnTo(stored, defaultPath);
  } catch {
    return defaultPath;
  } finally {
    try {
      window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* Already unreadable storage; nothing to clean up. */
    }
  }
}
