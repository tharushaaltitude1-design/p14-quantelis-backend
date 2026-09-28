import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { firebaseAuth, isFirebaseConfigured, loadAnalytics } from '@/lib/firebase';
import {
  authErrorMessage,
  sendResetEmail as sendReset,
  signInWithEmail,
  signInWithGoogle as signInWithGoogleUser,
  signOutUser,
  signUpWithEmail,
  updateUserProfile,
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
      updateProfile,
    }),
    [user, status, profileVersion, signIn, signInWithGoogle, signUp, signOut, sendResetEmail, updateProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
