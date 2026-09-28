import { initializeApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';

/**
 * Firebase bootstrap.
 *
 * Configuration is read from `VITE_FIREBASE_*` env vars (see `.env.example`) rather than
 * hardcoded, so the same build can target a different Firebase project per environment.
 *
 * The Firebase *web* config is not a secret: it is designed to be present in the shipped
 * bundle. What actually protects user data is Firebase Authentication plus Firestore and
 * Storage Security Rules, and the authorised-domains list in the Firebase console.
 *
 * When the config is absent the module exports `auth === null` and the app keeps working
 * against its local workspace store, so a fresh clone still renders instead of crashing.
 */

const firebaseConfig: FirebaseOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

/** A config is only usable once the three values `initializeApp` cannot default are present. */
export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId && firebaseConfig.authDomain,
);

let cachedApp: FirebaseApp | null = null;
let cachedAuth: Auth | null = null;

if (isFirebaseConfigured) {
  cachedApp = initializeApp(firebaseConfig);
  cachedAuth = getAuth(cachedApp);
}

export const firebaseApp = cachedApp;
export const firebaseAuth = cachedAuth;

/**
 * Analytics is loaded lazily and never allowed to break the app: it needs a real browser with
 * cookies/measurement support, and it throws in jsdom, private-mode browsers and ad blockers.
 */
export function loadAnalytics(): void {
  // Production only — this keeps the dev server and the jsdom test run free of measurement
  // noise, and measurement IDs are rate-limited per browser anyway.
  if (!import.meta.env.PROD) return;
  if (!cachedApp || !firebaseConfig.measurementId) return;
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  void import('firebase/analytics')
    .then(async ({ getAnalytics, isSupported }) => {
      if (!(await isSupported()) || !cachedApp) return;
      getAnalytics(cachedApp);
    })
    .catch(() => {
      /* Blocked or unsupported — measurement is optional, so fail silently. */
    });
}
