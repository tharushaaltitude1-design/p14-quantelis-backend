import { describe, expect, it } from 'vitest';
import { initialsFor } from '@/lib/initials';

describe('initialsFor', () => {
  it('uses first and last initial for a two-word name', () => {
    expect(initialsFor('Alex Rivera')).toBe('AR');
  });

  it('uses first and last initial for a three-word name, not the first two words', () => {
    expect(initialsFor('Alex Jordan Rivera')).toBe('AR');
  });

  it('takes the first two letters of a single word', () => {
    expect(initialsFor('Prince')).toBe('PR');
  });

  it('handles a single letter', () => {
    expect(initialsFor('J')).toBe('J');
  });

  it('is case-insensitive', () => {
    expect(initialsFor('aLEX rIVERA')).toBe('AR');
  });

  it('tolerates extra whitespace', () => {
    expect(initialsFor('  Alex   Rivera  ')).toBe('AR');
  });

  it('returns a placeholder for empty, null or undefined input', () => {
    // A missing name must not crash an avatar that has no photo to fall back from.
    expect(initialsFor('')).toBe('?');
    expect(initialsFor('   ')).toBe('?');
    expect(initialsFor(null)).toBe('?');
    expect(initialsFor(undefined)).toBe('?');
  });
});
