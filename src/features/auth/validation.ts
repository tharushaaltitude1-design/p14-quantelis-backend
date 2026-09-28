/** Shared client-side validation for the auth screens. Mirrors what Firebase Auth enforces. */

export const MIN_PASSWORD_LENGTH = 8;

/** Firebase requires >= 6 characters; the UI asks for 8 because that is the real floor today. */
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export type FieldErrors = Partial<Record<'fullName' | 'email' | 'password' | 'confirmPassword', string>>;

export function validateEmail(email: string): string | undefined {
  if (!email.trim()) return 'Enter your email address.';
  if (!EMAIL_PATTERN.test(email.trim())) return 'That does not look like a valid email address.';
  return undefined;
}

export function validatePassword(password: string): string | undefined {
  if (!password) return 'Choose a password.';
  if (password.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) return 'Mix in at least one letter and one number.';
  return undefined;
}

export function validateFullName(name: string): string | undefined {
  if (!name.trim()) return 'Tell us your name.';
  if (name.trim().length < 2) return 'That name looks too short.';
  return undefined;
}

export function validateSignIn(values: { email: string; password: string }): FieldErrors {
  const errors: FieldErrors = {};
  const email = validateEmail(values.email);
  if (email) errors.email = email;
  if (!values.password) errors.password = 'Enter your password.';
  return errors;
}

export function validateSignUp(values: { fullName: string; email: string; password: string; confirmPassword: string }): FieldErrors {
  const errors: FieldErrors = {};
  const name = validateFullName(values.fullName);
  if (name) errors.fullName = name;
  const email = validateEmail(values.email);
  if (email) errors.email = email;
  const password = validatePassword(values.password);
  if (password) errors.password = password;
  if (values.password !== values.confirmPassword) errors.confirmPassword = 'Passwords do not match.';
  return errors;
}

export function hasErrors(errors: FieldErrors): boolean {
  return Object.values(errors).some(Boolean);
}

export type Strength = { score: 0 | 1 | 2 | 3 | 4; label: string };

/** Simple, honest strength read-out. Length and variety, nothing clever. */
export function passwordStrength(password: string): Strength {
  if (!password) return { score: 0, label: '' };
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((pattern) => pattern.test(password)).length;
  if (classes >= 3) score += 1;
  if (classes === 4 && password.length >= 10) score += 1;
  const bounded = Math.min(4, score) as Strength['score'];
  const labels = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong'];
  return { score: bounded, label: labels[bounded] };
}
