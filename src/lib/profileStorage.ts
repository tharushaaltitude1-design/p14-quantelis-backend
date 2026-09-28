import { getDownloadURL, getStorage, ref, uploadBytes, deleteObject } from 'firebase/storage';
import { firebaseApp, firebaseAuth } from '@/lib/firebase';

/**
 * Profile photo storage.
 *
 * The picker hands us a `File`, so the bytes go to Cloud Storage and the resulting download URL
 * is written to `user.photoURL`. Storing a base64 data-URL on the auth record instead would
 * bloat every profile read and is rejected by Firebase for images beyond a few KB.
 */

const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

export function validatePhoto(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) return 'Choose a PNG, JPG or WebP image.';
  if (file.size > MAX_PHOTO_BYTES) return 'Photos must be smaller than 2 MB.';
  return null;
}

function requireDeps() {
  if (!firebaseApp || !firebaseAuth) throw new Error('Firebase is not configured. Add the VITE_FIREBASE_* values to .env.');
  const user = firebaseAuth.currentUser;
  if (!user) throw new Error('You need to be signed in to change your photo.');
  return { storage: getStorage(firebaseApp), user };
}

/** Uploads the photo and returns its public download URL. */
export async function uploadProfilePhoto(file: File): Promise<string> {
  const { storage, user } = requireDeps();
  const objectRef = ref(storage, `users/${user.uid}/avatar`);
  await uploadBytes(objectRef, file, { contentType: file.type });
  // A cache-busting token prevents the old avatar being served from the CDN after a change.
  return `${await getDownloadURL(objectRef)}?v=${Date.now()}`;
}

/** Best-effort cleanup; a failed delete must not block clearing the photo locally. */
export async function deleteProfilePhoto(photoURL: string): Promise<void> {
  try {
    const { storage, user } = requireDeps();
    const path = decodeURIComponent(new URL(photoURL).pathname.split('/o/')[1] ?? '');
    if (!path.startsWith(`users/${user.uid}/`)) return;
    await deleteObject(ref(storage, path));
  } catch {
    /* Already gone, or storage unavailable — the local reference is cleared regardless. */
  }
}
