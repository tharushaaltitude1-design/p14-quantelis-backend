import { describe, expect, it } from 'vitest';
import {
  hasErrors,
  passwordStrength,
  validateEmail,
  validateFullName,
  validatePassword,
  validateSignIn,
  validateSignUp,
} from '../validation';

describe('auth validation', () => {
  it('accepts realistic email addresses and rejects malformed ones', () => {
    expect(validateEmail('alex.rivera@quantelis.lk')).toBeUndefined();
    expect(validateEmail('  jordan+mitchell@company.co.uk  ')).toBeUndefined();
    expect(validateEmail('')).toBe('Enter your email address.');
    expect(validateEmail('nope')).toBe('That does not look like a valid email address.');
    expect(validateEmail('a@b')).toBeTruthy();
    expect(validateEmail('a b@c.com')).toBeTruthy();
  });

  it('requires length and variety in a password', () => {
    expect(validatePassword('short1')).toBe('Use at least 8 characters.');
    expect(validatePassword('alllettersonly')).toBe('Mix in at least one letter and one number.');
    expect(validatePassword('forecast2026')).toBeUndefined();
  });

  it('validates the display name', () => {
    expect(validateFullName('Alex Rivera')).toBeUndefined();
    expect(validateFullName('  ')).toBe('Tell us your name.');
    expect(validateFullName('A')).toBe('That name looks too short.');
  });

  it('collects every sign-up problem at once instead of one at a time', () => {
    const errors = validateSignUp({ fullName: '', email: 'bad', password: 'abc', confirmPassword: 'xyz' });
    expect(Object.keys(errors).sort()).toEqual(['confirmPassword', 'email', 'fullName', 'password']);
    expect(hasErrors(errors)).toBe(true);
  });

  it('only reports the password field missing on sign-in', () => {
    const errors = validateSignIn({ email: 'alex@quantelis.lk', password: '' });
    expect(errors).toEqual({ password: 'Enter your password.' });
    expect(hasErrors(validateSignIn({ email: 'alex@quantelis.lk', password: 'forecast2026' }))).toBe(false);
  });

  it('reads password strength upward and never exceeds four', () => {
    expect(passwordStrength('')).toEqual({ score: 0, label: '' });
    expect(passwordStrength('abc').score).toBeLessThan(2);
    expect(passwordStrength('Forecast2026!').score).toBe(4);
    expect(passwordStrength('Forecast2026!').label).toBe('Strong');
  });
});
