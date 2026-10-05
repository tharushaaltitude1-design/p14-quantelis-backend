import { vi } from 'vitest';
import type { User } from 'firebase/auth';
import type { AuthContextValue } from '@/state/authContext';

/** Builds an auth context value with spies, for testing screens without the Firebase SDK. */
export function makeAuthValue(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    user: null,
    status: 'unauthenticated',
    profileVersion: 0,
    isDemoMode: false,
    signIn: vi.fn().mockResolvedValue(undefined),
    signInWithGoogle: vi.fn().mockResolvedValue(undefined),
    signUp: vi.fn().mockResolvedValue({ verificationEmailSent: true }),
    signOut: vi.fn().mockResolvedValue(undefined),
    sendResetEmail: vi.fn().mockResolvedValue(undefined),
    verifyResetCode: vi.fn().mockResolvedValue('alex.rivera@quantelis.lk'),
    confirmPasswordReset: vi.fn().mockResolvedValue(undefined),
    redirectError: null,
    clearRedirectError: vi.fn(),
    updateProfile: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

/** Minimal `User` stand-in — only the fields the app reads. */
export function makeUser(overrides: Partial<User> = {}): User {
  return {
    uid: 'uid-1',
    email: 'alex.rivera@quantelis.lk',
    displayName: 'Alex Rivera',
    photoURL: null,
    emailVerified: true,
    ...overrides,
  } as User;
}
