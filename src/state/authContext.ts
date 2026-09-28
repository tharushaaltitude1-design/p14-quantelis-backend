import { createContext, useContext } from 'react';
import type { User } from 'firebase/auth';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export type AuthContextValue = {
  user: User | null;
  status: AuthStatus;
  /**
   * Bumped after every profile write. Firebase mutates the same `User` instance in place, so
   * this counter is what tells React to re-read `user.displayName` / `user.photoURL` without
   * fabricating a plain object (which would strip the real `User` prototype methods).
   */
  profileVersion: number;
  /** True when no `VITE_FIREBASE_*` config is present, so the app runs on its local demo session. */
  isDemoMode: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: { fullName: string; email: string; password: string }) => Promise<{ verificationEmailSent: boolean }>;
  signOut: () => Promise<void>;
  sendResetEmail: (email: string) => Promise<void>;
  updateProfile: (changes: { displayName?: string; photoURL?: string }) => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>.');
  return value;
}
