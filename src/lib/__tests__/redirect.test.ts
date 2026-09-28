import { describe, expect, it } from 'vitest';
import { isSafeReturnTo, safeReturnTo } from '@/lib/redirect';

describe('safeReturnTo — open redirect protection', () => {
  // Each of these would be interpreted by the browser as a *different origin* if handed straight
  // to navigate(). A crafted sign-in link is the delivery mechanism, so all must fall back.
  it.each([
    ['protocol-relative URL', '//evil.com'],
    ['protocol-relative with path', '//evil.com/steal'],
    ['absolute https URL', 'https://evil.com'],
    ['absolute http URL', 'http://evil.com'],
    ['javascript scheme', 'javascript:alert(1)'],
    ['javascript scheme uppercase', 'JavaScript:alert(1)'],
    ['data scheme', 'data:text/html,<script>alert(1)</script>'],
    ['backslash variant of protocol-relative', '/\\evil.com'],
    ['backslash path', '/path\\to'],
    ['relative path with no leading slash', 'evil.com'],
    ['empty string', ''],
    ['whitespace only', '   '],
  ])('rejects %s', (_label, value) => {
    expect(safeReturnTo(value)).toBe('/');
    expect(isSafeReturnTo(value)).toBe(false);
  });

  it.each([
    ['a padded protocol-relative URL', '  //evil.com  '],
    ['a newline before a scheme', '\njavascript:alert(1)'],
    ['a tab inside a scheme', 'java\tscript:alert(1)'],
    ['a carriage return inside a scheme', 'java\rscript:alert(1)'],
    ['a null byte', '/path\u0000'],
  ])('rejects %s even though it is trimmed or contains control characters', (_label, value) => {
    expect(isSafeReturnTo(value)).toBe(false);
  });

  it.each([
    ['the overview', '/'],
    ['a top-level page', '/datasets'],
    ['a detail page', '/datasets/12'],
    ['a nested detail page', '/projects/prj-1/edit'],
    ['a path with a query string', '/history?tab=runs&page=2'],
    ['a path with a hash', '/settings#billing'],
    ['a trailing slash', '/scenarios/'],
    ['a hyphenated segment', '/scenario-detail'],
  ])('accepts %s', (_label, value) => {
    expect(safeReturnTo(value)).toBe(value);
    expect(isSafeReturnTo(value)).toBe(true);
  });

  // Deliberately conservative: a colon is rejected anywhere in the path, not just in the first
  // segment. `javascript:` is only dangerous as a leading colon, so this rejects some legitimate
  // paths (`/datasets/urn:1234`) — but a redirect target is never worth a parsing edge case, and
  // the fallback is a safe local route.
  it.each([
    ['a colon in a later segment', '/datasets/urn:1234'],
    ['an ISO timestamp segment', '/datasets/2026-01-01T00:00'],
  ])('conservatively rejects %s', (_label, value) => {
    expect(safeReturnTo(value)).toBe('/');
    expect(isSafeReturnTo(value)).toBe(false);
  });

  it('honours a custom fallback', () => {
    expect(safeReturnTo('https://evil.com', '/login')).toBe('/login');
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['a number', 42],
    ['an object', { path: '/datasets' }],
    ['an array', ['/datasets']],
    ['a boolean', true],
  ])('falls back for non-string input: %s', (_label, value) => {
    expect(safeReturnTo(value)).toBe('/');
    expect(isSafeReturnTo(value)).toBe(false);
  });

  it('trims surrounding whitespace from an otherwise valid path', () => {
    expect(safeReturnTo('  /datasets  ')).toBe('/datasets');
  });
});
