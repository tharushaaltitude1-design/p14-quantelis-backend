import { FirebaseError } from 'firebase/app';
import {
  GoogleAuthProvider,
  confirmPasswordReset,
  getRedirectResult,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
  updateProfile as firebaseUpdateProfile,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  verifyPasswordResetCode,
  type ActionCodeSettings,
  type User,
} from 'firebase/auth';
import { firebaseAuth } from '@/lib/firebase';
import { ROUTES } from '@/config/constants';

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
  'auth/missing-email': 'Enter the email address for your account.',
  'auth/email-already-in-use': 'An account already exists for that email. Sign in instead.',
  'auth/weak-password': 'Passwords need at least 6 characters. Add a little more length or complexity.',
  'auth/operation-not-allowed': 'Email and password sign-in is disabled for this Firebase project.',
  'auth/too-many-requests': 'Too many attempts. Wait a minute and try again.',
  'auth/network-request-failed': 'Network error. Check your connection and try again.',
  'auth/popup-closed-by-user': 'The Google sign-in window closed before finishing.',
  'auth/popup-blocked': 'Your browser blocked the Google sign-in window. Allow pop-ups for this site, then try again.',
  'auth/cancelled-popup-request': 'Another sign-in window is already open. Finish that one first.',
  'auth/operation-not-supported-in-this-environment': 'Google sign-in is not available in this browser.',
  'auth/account-exists-with-different-credential':
    'An account already uses that email with a different sign-in method. Sign in with your password instead.',
  'auth/credential-already-in-use': 'Those Google credentials are already linked to another account.',
  'auth/requires-recent-login': 'For security, sign in again before making this change.',
  'auth/user-disabled': 'This account has been disabled. Contact your workspace admin.',
  'auth/user-cancelled': 'Google sign-in was cancelled.',
  'auth/quota-exceeded': 'Firebase quota reached. Try again shortly.',
  // Password-reset codes. `expired` is by far the most common: the link is single-use and the
  // older template links stop working after an hour.
  'auth/expired-action-code': 'That reset link has expired or has already been used. Request a new one.',
  'auth/invalid-action-code': 'That reset link is not valid. Request a new one.',
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

function googleProvider() {
  const provider = new GoogleAuthProvider();
  // Without this, returning users are silently signed into the wrong Google identity.
  provider.setCustomParameters({ prompt: 'select_account' });
  return provider;
}

/**
 * Popups are refused outright in several real environments — mobile Safari and most in-app
 * browsers, and any desktop browser or host policy that treats the app as popup-hostile. In those
 * cases a full-page redirect to Google is the only flow that completes, so it is the fallback.
 * A user who deliberately closes the popup is *not* retried: silently reloading the page at them
 * would be worse than the message they just dismissed.
 */
const REDIRECT_FALLBACK_CODES = new Set([
  'auth/popup-blocked',
  'auth/cancelled-popup-request',
  'auth/network-request-failed',
  'auth/operation-not-supported-in-this-environment',
  'auth/internal-error',
]);

function shouldFallBackToRedirect(error: unknown): boolean {
  return error instanceof FirebaseError && REDIRECT_FALLBACK_CODES.has(error.code);
}

export type SignUpInput = { fullName: string; email: string; password: string };
export type SignUpResult = { user: User; verificationEmailSent: boolean };

export async function signInWithEmail(email: string, password: string): Promise<User> {
  const credential = await signInWithEmailAndPassword(requireAuth(), email.trim(), password);
  return credential.user;
}

/**
 * Google sign-in / sign-up.
 *
 * The same call serves both flows: Firebase provisions a Firebase account on first use and
 * returns the existing one afterwards, and Google's email is already verified, so the
 * sign-up path can skip the verification email entirely.
 *
 * Tries the popup first because it keeps the user on the page, then falls back to a full-page
 * redirect when the environment refuses popups. In that second case the document is being torn
 * down, so the returned promise never settles — the user comes back through
 * {@link completeGoogleRedirect} instead.
 */
export async function signInWithGoogle(): Promise<User> {
  const auth = requireAuth();
  const provider = googleProvider();
  try {
    const credential = await signInWithPopup(auth, provider);
    return credential.user;
  } catch (error) {
    if (!shouldFallBackToRedirect(error)) throw error;
    await signInWithRedirect(auth, provider);
    return new Promise<User>(() => {});
  }
}

/**
 * Completes the redirect leg of {@link signInWithGoogle}.
 *
 * Must run before anything reads `auth.currentUser`, because this is what exchanges the
 * `idToken` query parameter Google appended for a real session. Rejections are resolved rather
 * than thrown so a failed sign-in surfaces as a message on the sign-in screen instead of an
 * unhandled rejection during start-up.
 */
export async function completeGoogleRedirect(): Promise<User | null> {
  if (!firebaseAuth) return null;
  try {
    const result = await getRedirectResult(firebaseAuth);
    return result ? result.user : null;
  } catch (error) {
    // The visitor backed out of the Google consent screen — nothing to report.
    if (error instanceof FirebaseError && error.code === 'auth/user-cancelled') return null;
    throw error;
  }
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

/**
 * Where the emailed reset link should land.
 *
 * Without `handleCodeInApp`, Firebase redirects to whatever continuation URL is configured in
 * the console rather than to this app, so the reset dead-ends on Google's default page and the
 * user cannot get back into the workspace. Returns `undefined` outside a browser (SSR, tests),
 * where there is no origin to build an absolute URL from and the console default is correct.
 */
function resetActionCodeSettings(): ActionCodeSettings | undefined {
  if (typeof window === 'undefined' || !window.location?.origin) return undefined;
  return { url: `${window.location.origin}${ROUTES.resetPassword}`, handleCodeInApp: true };
}

export async function sendResetEmail(email: string): Promise<void> {
  await sendPasswordResetEmail(requireAuth(), email.trim(), resetActionCodeSettings());
}

/**
 * Checks a reset code before showing the form, and returns the address it belongs to.
 *
 * Verifying up front means an expired or already-used link is reported immediately, instead of
 * the user typing a new password only to be told at the end that the link is dead.
 */
export async function verifyResetCode(oobCode: string): Promise<string> {
  return verifyPasswordResetCode(requireAuth(), oobCode);
}

/** Consumes a reset code and sets the new password. Single use — the code dies afterwards. */
export async function confirmPasswordResetCode(oobCode: string, newPassword: string): Promise<void> {
  await confirmPasswordReset(requireAuth(), oobCode, newPassword);
}

export async function updateUserProfile(changes: { displayName?: string; photoURL?: string }): Promise<void> {
  const user = requireAuth().currentUser;
  if (!user) throw new Error('You need to be signed in to update your profile.');
  await firebaseUpdateProfile(user, changes);
}

export async function signOutUser(): Promise<void> {
  await firebaseSignOut(requireAuth());
}
