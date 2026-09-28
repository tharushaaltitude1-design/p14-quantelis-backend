import { FirebaseError } from 'firebase/app';
import {
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile as firebaseUpdateProfile,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  type User,
} from 'firebase/auth';
import { firebaseAuth } from '@/lib/firebase';

/**
 * Firebase throws string-coded errors; the UI must never show `auth/invalid-credential` to a
 * person. Every code the auth flow can produce is mapped to an actionable sentence here.
 */
const AUTH_ERROR_MESSAGES: Record<string, string> = {
  'auth/invalid-credential': 'That email and password combination did not match an account.',
  'auth/user-not-found': 'No account exists for that email address.',
  'auth/wrong-password': 'That password is not correct.',
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/missing-password': 'Enter your password.',
  'auth/email-already-in-use': 'An account already exists for that email. Sign in instead.',
  'auth/weak-password': 'Passwords need at least 6 characters. Add a little more length or complexity.',
  'auth/operation-not-allowed': 'Email and password sign-in is disabled for this Firebase project.',
  'auth/too-many-requests': 'Too many attempts. Wait a minute and try again.',
  'auth/network-request-failed': 'Network error. Check your connection and try again.',
  'auth/popup-closed-by-user': 'The sign-in window closed before finishing.',
  'auth/requires-recent-login': 'For security, sign in again before making this change.',
  'auth/user-disabled': 'This account has been disabled. Contact your workspace admin.',
  'auth/quota-exceeded': 'Firebase quota reached. Try again shortly.',
};

export function authErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (error instanceof FirebaseError) return AUTH_ERROR_MESSAGES[error.code] ?? fallback;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function requireAuth() {
  if (!firebaseAuth) throw new Error('Firebase Auth is not configured. Add the VITE_FIREBASE_* values to .env.');
  return firebaseAuth;
}

export type SignUpInput = { fullName: string; email: string; password: string };
export type SignUpResult = { user: User; verificationEmailSent: boolean };

export async function signInWithEmail(email: string, password: string): Promise<User> {
  const credential = await signInWithEmailAndPassword(requireAuth(), email.trim(), password);
  return credential.user;
}

export async function signUpWithEmail({ fullName, email, password }: SignUpInput): Promise<SignUpResult> {
  const credential = await createUserWithEmailAndPassword(requireAuth(), email.trim(), password);
  // The display name is only settable after the account exists, so it is a second call.
  await firebaseUpdateProfile(credential.user, { displayName: fullName.trim() });

  let verificationEmailSent = false;
  try {
    await sendEmailVerification(credential.user);
    verificationEmailSent = true;
  } catch {
    // A failed verification email must not block the sign-up; the user can retry from Profile.
  }
  return { user: credential.user, verificationEmailSent };
}

export async function sendResetEmail(email: string): Promise<void> {
  await sendPasswordResetEmail(requireAuth(), email.trim());
}

export async function updateUserProfile(changes: { displayName?: string; photoURL?: string }): Promise<void> {
  const user = requireAuth().currentUser;
  if (!user) throw new Error('You need to be signed in to update your profile.');
  await firebaseUpdateProfile(user, changes);
}

export async function signOutUser(): Promise<void> {
  await firebaseSignOut(requireAuth());
}
