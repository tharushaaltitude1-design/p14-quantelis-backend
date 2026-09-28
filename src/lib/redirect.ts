/**
 * Post-login redirect target sanitiser.
 *
 * Anything a caller supplies (a `returnTo` query string, a `location.state.from` stashed by the
 * route guard, a value handed back by an OAuth callback) is untrusted input. Passing such a value
 * straight to `navigate()` is the classic open-redirect pattern: `//evil.com` and
 * `https://evil.com` are both interpreted as external locations by the browser, so a crafted link
 * could bounce a freshly authenticated user to a convincing copy of the sign-in page.
 */

/** Default landing route when no safe target is supplied. */
const FALLBACK = '/';

/**
 * Returns `value` if it is a safe same-origin internal path, otherwise `fallback`.
 *
 * The checks are ordered so that the cheap structural ones run first, and each one closes a
 * distinct bypass:
 * - must be a string, and must start with a single `/`
 * - must not start with `//` or `/\` (protocol-relative URL, or a backslash the browser
 *   normalises into one)
 * - must not contain a scheme at all (`http:`, `javascript:`, `data:`), which also defeats
 *   leading-whitespace and embedded-newline tricks such as `java\nscript:`
 * - must not contain a backslash anywhere, since some browsers normalise it to a slash
 *
 * A path that survives all of this is rendered by the router, so it cannot leave the origin.
 */
export function safeReturnTo(value: unknown, fallback: string = FALLBACK): string {
  if (typeof value !== 'string') return fallback;

  const candidate = value.trim();
  if (!candidate.startsWith('/')) return fallback;
  if (candidate.startsWith('//') || candidate.startsWith('/\\')) return fallback;
  if (candidate.includes('\\')) return fallback;
  if (candidate.includes(':')) return fallback;
  // Control characters can be used to smuggle a scheme past the check above, or to confuse a
  // downstream parser. Reject rather than try to strip.
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001F\u007F]/.test(candidate)) return fallback;

  return candidate;
}

/** True when `value` would be accepted by {@link safeReturnTo} unchanged. */
export function isSafeReturnTo(value: unknown): boolean {
  return typeof value === 'string' && safeReturnTo(value, FALLBACK) === value.trim();
}
