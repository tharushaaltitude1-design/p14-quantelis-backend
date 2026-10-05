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
  /**
   * Resolves once the user is signed in. Never settles when the call had to fall back to a
   * full-page Google redirect, because the document is being torn down at that point.
   */
  signInWithGoogle: () => Promise<void>;
  signUp: (input: { fullName: string; email: string; password: string }) => Promise<{ verificationEmailSent: boolean }>;
  signOut: () => Promise<void>;
  sendResetEmail: (email: string) => Promise<void>;
  /** Confirms a reset link is live and returns the address it belongs to. */
  verifyResetCode: (oobCode: string) => Promise<string>;
  /** Sets a new password from a reset link. The code is single-use. */
  confirmPasswordReset: (oobCode: string, newPassword: string) => Promise<void>;
  /**
   * Why a Google sign-in that came back through a redirect failed, or `null`. Held on the context
   * because the return trip reloads the app, so no component that existed before the redirect
   * survives to render the message — the sign-in screen has to read it on mount instead.
   */
  redirectError: string | null;
  clearRedirectError: () => void;
  updateProfile: (changes: { displayName?: string; photoURL?: string }) => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>.');
  return value;
}
