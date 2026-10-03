import { getFirestore, type Firestore } from 'firebase/firestore';
import { firebaseApp, isFirebaseConfigured } from './firebase';

/**
 * Firestore bootstrap.
 *
 * Firestore is only reachable when Firebase itself is configured, so this reuses the same
 * `firebaseApp` instance rather than calling `initializeApp` a second time. When the config is
 * absent — a fresh clone, the jsdom test run — `db` is `null` and the workspace store falls back
 * to its bundled seed data, so nothing downstream has to null-check at every call site: check
 * `isFirestoreEnabled` once, at the edge.
 */

let cachedDb: Firestore | null = null;

if (firebaseApp) {
  cachedDb = getFirestore(firebaseApp);
}

export const db = cachedDb;

/** True when a real Firestore instance exists and the store should persist instead of seeding. */
export const isFirestoreEnabled = isFirebaseConfigured && cachedDb !== null;