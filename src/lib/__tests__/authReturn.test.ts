import { beforeEach, describe, expect, it } from 'vitest';
import { rememberReturnTo, takeReturnTo } from '@/lib/authReturn';

/**
 * The value in `sessionStorage` is read back before `navigate()`, so the sanitiser has to run on
 * the way out as well as on the way in — anything that can write to storage can write a value
 * that would otherwise send a freshly authenticated user to another origin.
 */
describe('remembered return destination', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it('falls back to the supplied default when nothing was stored', () => {
    expect(takeReturnTo('/')).toBe('/');
  });

  it('returns the stored path once and then forgets it', () => {
    rememberReturnTo('/datasets');
    expect(takeReturnTo('/')).toBe('/datasets');
    // A stale target must not capture the *next* sign-in.
    expect(takeReturnTo('/')).toBe('/');
  });

  it('keeps a legitimate deep link intact', () => {
    rememberReturnTo('/projects/prj-1/edit?tab=runs');
    expect(takeReturnTo('/')).toBe('/projects/prj-1/edit?tab=runs');
  });

  it('refuses a crafted value written directly to storage', () => {
    window.sessionStorage.setItem('quantelis.auth.returnTo', '//evil.com');
    expect(takeReturnTo('/')).toBe('/');

    window.sessionStorage.setItem('quantelis.auth.returnTo', 'https://evil.com/steal');
    expect(takeReturnTo('/')).toBe('/');

    window.sessionStorage.setItem('quantelis.auth.returnTo', 'javascript:alert(1)');
    expect(takeReturnTo('/')).toBe('/');
  });

  it('never stores an unsafe path in the first place', () => {
    rememberReturnTo('https://evil.com');
    expect(takeReturnTo('/')).toBe('/');
  });

  it('clears a rejected value rather than leaving it to fail again', () => {
    window.sessionStorage.setItem('quantelis.auth.returnTo', '//evil.com');
    takeReturnTo('/');
    expect(window.sessionStorage.getItem('quantelis.auth.returnTo')).toBeNull();
  });
});
