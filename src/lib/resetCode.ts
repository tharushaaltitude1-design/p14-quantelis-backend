const STORAGE_KEY = 'quantelis.auth.resetCode';

/**
 * The password-reset code, wherever the emailed link happened to put it.
 *
 * Firebase normally hands the code over as `?oobCode=…`, but the URL is the least reliable place to
 * keep it. A reload, a back/forward step, a restored tab, a mail client that rewrites long links,
 * or a link scanner that follows the URL before the user does can all leave `/reset-password` with
 * nothing after it — and the reset then dead-ends on "that link is missing its reset code" even
 * though the email is still perfectly good. The fragment is accepted too, for clients that append
 * parameters after the `#`.
 */
export function resetCodeFromLocation(search: string, hash: string): { code: string; fromFragment: boolean } {
  const fromSearch = paramValue(search, 'oobCode');
  if (fromSearch) return { code: fromSearch, fromFragment: false };

  const fromHash = paramValue(hash, 'oobCode');
  return fromHash ? { code: fromHash, fromFragment: true } : { code: '', fromFragment: false };
}

function paramValue(source: string, key: string): string {
  if (!source) return '';
  // `URLSearchParams` would read the leading `#` as part of the first key.
  const raw = source.charAt(0) === '#' ? source.slice(1) : source;
  try {
    return new URLSearchParams(raw).get(key)?.trim() ?? '';
  } catch {
    return '';
  }
}

/**
 * Keeps the live code for the lifetime of the tab.
 *
 * `sessionStorage` is the only store that survives a reload — the failure this guards against — while
 * still dying with the tab, which is the lifetime a single-use reset link is worth. Storage is
 * writable by any script on the origin, so a hand-edited value is treated as untrusted input: it is
 * only ever passed straight to Firebase, which is the component that actually decides whether a code
 * is valid.
 */
export function rememberResetCode(code: string): void {
  if (!code || typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, code);
  } catch {
    // Private-mode Safari and some embedded browsers throw on any storage access. Without the copy
    // the flow still works as long as the URL keeps its query string.
  }
}

/** The remembered code, or `''` when there is none. */
export function loadResetCode(): string {
  if (typeof window === 'undefined') return '';
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

/**
 * Drops the remembered code.
 *
 * Called as soon as a code is known to be spent — consumed by a successful reset, or refused by
 * Firebase — so a later visit to `/reset-password` starts clean instead of retrying a dead link.
 */
export function forgetResetCode(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* Already unreadable storage; nothing to clean up. */
  }
}
