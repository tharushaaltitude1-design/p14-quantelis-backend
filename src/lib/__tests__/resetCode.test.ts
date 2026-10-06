import { beforeEach, describe, expect, it } from 'vitest';
import { forgetResetCode, loadResetCode, rememberResetCode, resetCodeFromLocation } from '@/lib/resetCode';

describe('reset code', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  describe('reading it out of the link', () => {
    it('takes it from the query string Firebase sends it in', () => {
      expect(resetCodeFromLocation('?mode=resetPassword&oobCode=code-1', '')).toEqual({
        code: 'code-1',
        fromFragment: false,
      });
    });

    it('falls back to the fragment for clients that append parameters after the #', () => {
      expect(resetCodeFromLocation('', '#oobCode=code-2')).toEqual({ code: 'code-2', fromFragment: true });
      expect(resetCodeFromLocation('', '#mode=resetPassword&oobCode=code-2')).toEqual({
        code: 'code-2',
        fromFragment: true,
      });
    });

    it('prefers the query string when both are present', () => {
      expect(resetCodeFromLocation('?oobCode=from-query', '#oobCode=from-hash')).toEqual({
        code: 'from-query',
        fromFragment: false,
      });
    });

    it('reports nothing rather than an empty or whitespace code', () => {
      expect(resetCodeFromLocation('', '')).toEqual({ code: '', fromFragment: false });
      expect(resetCodeFromLocation('?oobCode=', '')).toEqual({ code: '', fromFragment: false });
      expect(resetCodeFromLocation('?oobCode=%20%20', '')).toEqual({ code: '', fromFragment: false });
      expect(resetCodeFromLocation('?mode=resetPassword', '')).toEqual({ code: '', fromFragment: false });
    });
  });

  describe('keeping it for the tab', () => {
    it('survives a read that finds no code in the URL', () => {
      rememberResetCode('code-3');
      expect(loadResetCode()).toBe('code-3');
      expect(resetCodeFromLocation('', '').code || loadResetCode()).toBe('code-3');
    });

    it('forgets it once it is spent, so nothing retries a dead link', () => {
      rememberResetCode('code-4');
      forgetResetCode();
      expect(loadResetCode()).toBe('');
    });

    it('does not overwrite a live code with nothing', () => {
      rememberResetCode('code-5');
      rememberResetCode('');
      expect(loadResetCode()).toBe('code-5');
    });
  });
});
