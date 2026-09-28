/**
 * Initials for an avatar fallback. Handles 1, 2 and 3+ word names, and empty input, so
 * `Avatar` always has something to render when a photo is missing or fails to load.
 */
export function initialsFor(name: string | null | undefined): string {
  const parts = (name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  // First and last word, so "Alex Jordan Rivera" reads as "AR" rather than "AJ".
  const first = parts[0][0] ?? '';
  const last = parts[parts.length - 1][0] ?? '';
  return `${first}${last}`.toUpperCase();
}
