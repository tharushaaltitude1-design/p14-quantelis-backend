import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { firebaseAuth, isFirebaseConfigured, loadAnalytics } from '@/lib/firebase';
import {
  authErrorMessage,
  completeGoogleRedirect,
  confirmPasswordResetCode as confirmReset,
  sendResetEmail as sendReset,
  signInWithEmail,
  signInWithGoogle as signInWithGoogleUser,
  signOutUser,
  signUpWithEmail,
  updateUserProfile,
  verifyResetCode as verifyReset,
} from '@/lib/authApi';
import { AuthContext, type AuthContextValue, type AuthStatus } from './authContext';

/**
 * Owns the Firebase session for the whole app.
 *
 * `status` starts as `loading` and only becomes `authenticated`/`unauthenticated` once
 * `onAuthStateChanged` has reported, or immediately when no Firebase config is present. Route
 * guards must wait for `loading` to settle, otherwise a refresh would bounce a signed-in user
 * to the sign-in screen before Firebase has answered.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthContextValue['user']>(null);
  const [status, setStatus] = useState<AuthStatus>(isFirebaseConfigured ? 'loading' : 'unauthenticated');
  const [profileVersion, setProfileVersion] = useState(0);
  const [redirectError, setRedirectError] = useState<string | null>(null);

  useEffect(() => {
    if (!firebaseAuth) {
      setStatus('unauthenticated');
      return;
    }
    loadAnalytics();
    return onAuthStateChanged(firebaseAuth, (nextUser) => {
      setUser(nextUser);
      setStatus(nextUser ? 'authenticated' : 'unauthenticated');
    });
  }, []);

  // Runs on every cold start, and is a no-op unless the URL still carries the token Google
  // appended to the redirect return. When it does, this exchange has to happen before the
  // guards read `status`, so `status` is deliberately left at `loading` until it settles —
  // otherwise the guard would bounce the user to /login for the frame in between.
  useEffect(() => {
    if (!firebaseAuth) return;
    let active = true;
    void completeGoogleRedirect().then(
      () => {
        if (active) setStatus((current) => (current === 'loading' ? 'unauthenticated' : current));
      },
      (error: unknown) => {
        if (!active) return;
        setRedirectError(authErrorMessage(error, 'Google sign-in did not complete. Please try again.'));
        setStatus('unauthenticated');
      },
    );
    return () => {
      active = false;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      await signInWithEmail(email, password);
    } catch (error) {
      throw new Error(authErrorMessage(error, 'We could not sign you in. Please try again.'));
    }
  }, []);

  const signInWithGoogle = useCallback(async () => {
    try {
      await signInWithGoogleUser();
    } catch (error) {
      throw new Error(authErrorMessage(error, 'Google sign-in did not complete. Please try again.'));
    }
  }, []);

  const signUp = useCallback(async (input: { fullName: string; email: string; password: string }) => {
    try {
      const result = await signUpWithEmail(input);
      return { verificationEmailSent: result.verificationEmailSent };
    } catch (error) {
      throw new Error(authErrorMessage(error, 'We could not create your account. Please try again.'));
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await signOutUser();
    } catch (error) {
      throw new Error(authErrorMessage(error, 'Signing out failed. Please try again.'));
    }
  }, []);

  const sendResetEmail = useCallback(async (email: string) => {
    try {
      await sendReset(email);
    } catch (error) {
      throw new Error(authErrorMessage(error, 'We could not send that reset email.'));
    }
  }, []);

  const verifyResetCode = useCallback(async (oobCode: string) => {
    try {
      return await verifyReset(oobCode);
    } catch (error) {
      throw new Error(authErrorMessage(error, 'That reset link is no longer valid.'));
    }
  }, []);

  const confirmPasswordReset = useCallback(async (oobCode: string, newPassword: string) => {
    try {
      await confirmReset(oobCode, newPassword);
    } catch (error) {
      throw new Error(authErrorMessage(error, 'We could not set that new password.'));
    }
  }, []);

  const clearRedirectError = useCallback(() => setRedirectError(null), []);

  const updateProfile = useCallback(async (changes: { displayName?: string; photoURL?: string }) => {
    try {
      await updateUserProfile(changes);
      // Firebase mutates the live `User` in place, so re-render consumers instead of replacing
      // the user with a plain object that no longer carries the real prototype methods.
      setProfileVersion((value) => value + 1);
    } catch (error) {
      throw new Error(authErrorMessage(error, 'We could not save your profile changes.'));
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      profileVersion,
      isDemoMode: !isFirebaseConfigured,
      signIn,
      signInWithGoogle,
      signUp,
      signOut,
      sendResetEmail,
      verifyResetCode,
      confirmPasswordReset,
      redirectError,
      clearRedirectError,
      updateProfile,
    }),
    [
      user,
      status,
      profileVersion,
      signIn,
      signInWithGoogle,
      signUp,
      signOut,
      sendResetEmail,
      verifyResetCode,
      confirmPasswordReset,
      redirectError,
      clearRedirectError,
      updateProfile,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
