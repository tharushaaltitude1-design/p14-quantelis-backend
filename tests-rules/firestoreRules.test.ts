/**
 * Replays the app's real Firestore calls against the emulator, so `firestore.rules` is proved to
 * accept what the app writes and refuse what it must.
 *
 * Why this exists: the field allowlists in the rules and the shapes in the fixtures are written
 * down in two different files. When they disagree, nothing fails at build time — the seed is simply
 * denied in production, as "Missing or insufficient permissions." These tests run the actual
 * `writeFixtureSeed` / `clearWorkspace` code against the actual rules file, so the two cannot drift
 * apart unnoticed.
 *
 * Runs outside `npm test` because it needs the emulator:
 *   npm run test:rules
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInWithCustomToken } from 'firebase/auth';
import { collection, deleteDoc, doc, getDoc, getDocs, initializeFirestore, setDoc, updateDoc } from 'firebase/firestore';
import {
  clearWorkspace,
  sectionDocRef,
  seedMarkerRef,
  userCollectionRef,
  userDocRef,
} from '../src/services/workspaceRepo';
import {
  buildSeedRows,
  SCHEMA_VERSION,
  writeFixtureSeed,
  writeSeedMarker,
} from '../src/services/seedWorkspace';

const here = dirname(fileURLToPath(import.meta.url));
const rules = readFileSync(resolve(here, '../firestore.rules'), 'utf8');

const OWNER = 'user-alex';
const STRANGER = 'user-mallory';
const IDENTITY = { fullName: 'Alex Rivera', email: 'alex@example.com' };

/**
 * An unsigned custom token carrying `uid`.
 *
 * The Auth emulator does not verify the signature, but it does parse the JWT and reject tokens
 * missing the standard claims — a bare string fails as `auth/invalid-custom-token`, and one without
 * `aud` fails as an invalid audience. So `uid` ends up as the only claim the rules can read, which
 * is the same situation as a real session.
 */
function customTokenFor(uid: string): string {
  const part = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const issuedAt = Math.floor(Date.now() / 1000);

  const header = part({ alg: 'RS256', typ: 'JWT' });
  const payload = part({
    iss: `https://securetoken.google.com/demo-quantelis`,
    aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',
    sub: uid,
    uid,
    iat: issuedAt,
    exp: issuedAt + 3600,
  });

  return `${header}.${payload}.`;
}

/**
 * The emulator is addressed the way the browser app is: a plain modular app pointed at the local
 * emulator, with Firebase Auth supplying the token. `authenticatedContext()` from the rules
 * testing package is not used because it hands back a compat instance, and the point of this suite
 * is to run the app's own modular `workspaceRepo` / `seedWorkspace` code against the rules
 * unmodified.
 */
async function storeAs(uid: string | null) {
  const name = `rules-${uid ?? 'anonymous'}`;
  const app: FirebaseApp = getApps().some((candidate) => candidate.name === name)
    ? getApp(name)
    : initializeApp(
        {
          projectId: 'demo-quantelis',
          apiKey: 'emulator-only',
          // Long polling rather than the Node gRPC/websocket transport, which the emulator does not speak.
          experimentalForceLongPolling: true,
        },
        name,
      );

  const db = initializeFirestore(app, { experimentalForceLongPolling: true });
  // Already pointed at the emulator by emulators:exec via FIRESTORE_EMULATOR_HOST.
  if (uid) {
    const auth = getAuth(app);
    connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099'}`, { disableWarnings: true });
    await signInWithCustomToken(auth, customTokenFor(uid));
  }

  return db;
}

/** Seeds the owner's account, as the provider does on first load. */
async function seedOwner() {
  const db = await storeAs(OWNER);
  await writeFixtureSeed(db, OWNER, IDENTITY);
  await writeSeedMarker(db, OWNER, SCHEMA_VERSION, true);
  return db;
}

const datasetRow = () => buildSeedRows().find((row) => row.collection === 'datasets')!;
const activityRow = () => buildSeedRows().find((row) => row.collection === 'activity')!;

beforeEach(async () => {
  // Each test starts from an empty emulator, so a "refused" result can never mean "already absent".
  const response = await fetch(
    `http://${process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080'}/emulator/v1/projects/demo-quantelis/databases/(default)/documents`,
    { method: 'DELETE' },
  );

  expect(response.ok, `could not reset the emulator: ${response.status} ${await response.text()}`).toBe(true);
});

describe('firestore.rules — a signed-out caller', () => {
  it('cannot read the profile, a collection, or the seed marker', async () => {
    const db = await storeAs(null);

    await expect(getDoc(userDocRef(db, OWNER))).rejects.toThrow(/permission/i);
    await expect(getDocs(userCollectionRef(db, OWNER, 'datasets'))).rejects.toThrow(/permission/i);
    await expect(getDoc(seedMarkerRef(db, OWNER))).rejects.toThrow(/permission/i);
  });
});

describe('firestore.rules — seeding', () => {
  it('accepts the whole seed as the provider writes it, in one batch', async () => {
    const db = await seedOwner();

    for (const row of buildSeedRows()) {
      const stored = await getDoc(doc(userCollectionRef(db, OWNER, row.collection), row.id));

      expect(stored.exists(), `${row.collection}/${row.id} was refused by the rules`).toBe(true);
      expect(stored.data()?.ord).toBe(row.ord);
    }

    expect((await getDoc(seedMarkerRef(db, OWNER))).data()).toMatchObject({ schemaVersion: SCHEMA_VERSION, seeded: true });
    expect((await getDoc(userDocRef(db, OWNER))).data()).toMatchObject({ fullName: 'Alex Rivera', email: 'alex@example.com' });
  });

  it('refuses a settings document that tries to store the API key', async () => {
    const db = await seedOwner();

    await expect(
      setDoc(sectionDocRef(db, OWNER, 'settings'), {
        name: 'Acme',
        timezone: 'UTC',
        currency: 'USD',
        notifications: {},
        marketFeedConnected: false,
        plan: 'Pro',
        revealApiKey: true,
      }),
    ).rejects.toThrow(/permission/i);

    // The refused write left the stored document alone rather than half-applying it.
    expect((await getDoc(sectionDocRef(db, OWNER, 'settings'))).data()).not.toHaveProperty('revealApiKey');
  });
});

describe('firestore.rules — owner writes', () => {
  it('lets the owner edit their profile and settings, preserving untouched fields', async () => {
    const db = await seedOwner();

    await updateDoc(userDocRef(db, OWNER), { fullName: 'Alex R.' });

    const profile = (await getDoc(userDocRef(db, OWNER))).data();
    expect(profile?.fullName).toBe('Alex R.');
    // `merge` means the rules see the whole post-write document, and `hasOnly` must still hold.
    expect(profile?.schemaVersion).toBe(SCHEMA_VERSION);
    expect(profile?.createdAt).toBeTypeOf('number');

    await updateDoc(sectionDocRef(db, OWNER, 'settings'), { name: 'Renamed workspace' });
    const settings = (await getDoc(sectionDocRef(db, OWNER, 'settings'))).data();
    expect(settings?.name).toBe('Renamed workspace');
    expect(settings?.currency).toBe('USD');
  });

  it('lets the owner add and remove a record', async () => {
    const db = await seedOwner();
    const ref = doc(userCollectionRef(db, OWNER, 'datasets'), 'd-new');

    await setDoc(ref, {
      id: 'd-new',
      ord: -1,
      name: 'Mine',
      source: 'CSV',
      rows: '1 MB',
      variables: 3,
      updated: 'Today',
      status: 'Processing',
      quality: 90,
      columns: ['a'],
    });
    expect((await getDoc(ref)).exists()).toBe(true);

    await deleteDoc(ref);
    expect((await getDoc(ref)).exists()).toBe(false);
  });

  it('refuses a payload that belongs to a different document id', async () => {
    const db = await seedOwner();

    await expect(
      setDoc(doc(userCollectionRef(db, OWNER, 'datasets'), datasetRow().id), { ...datasetRow().data, id: 'd-someone-else' }),
    ).rejects.toThrow(/permission/i);
  });

  it('refuses a field the app never reads', async () => {
    const db = await seedOwner();

    await expect(
      setDoc(doc(userCollectionRef(db, OWNER, 'datasets'), 'd-rogue'), { ...datasetRow().data, id: 'd-rogue', isAdmin: true }),
    ).rejects.toThrow(/permission/i);
  });

  it('refuses a status the UI has no branch for', async () => {
    const db = await seedOwner();

    await expect(
      setDoc(doc(userCollectionRef(db, OWNER, 'datasets'), 'd-odd'), { ...datasetRow().data, id: 'd-odd', status: 'Superior' }),
    ).rejects.toThrow(/permission/i);
  });

  it('refuses a rewritten activity entry, because the trail is append-only', async () => {
    const db = await seedOwner();

    await expect(updateDoc(doc(userCollectionRef(db, OWNER, 'activity'), activityRow().id), { status: 'Completed' })).rejects.toThrow(
      /permission/i,
    );
  });

  it('lets the owner clear the account and keep the profile', async () => {
    const db = await seedOwner();

    await clearWorkspace(db, OWNER);
    await writeSeedMarker(db, OWNER, SCHEMA_VERSION, false);

    expect((await getDocs(userCollectionRef(db, OWNER, 'datasets'))).empty).toBe(true);
    expect((await getDoc(sectionDocRef(db, OWNER, 'settings'))).exists()).toBe(false);
    expect((await getDoc(userDocRef(db, OWNER))).exists()).toBe(true);
    expect((await getDoc(seedMarkerRef(db, OWNER))).data()).toMatchObject({ seeded: false });
  });
});

describe('firestore.rules — another account', () => {
  it('cannot read the owner data', async () => {
    await seedOwner();
    const db = await storeAs(STRANGER);

    await expect(getDoc(userDocRef(db, OWNER))).rejects.toThrow(/permission/i);
    await expect(getDocs(userCollectionRef(db, OWNER, 'datasets'))).rejects.toThrow(/permission/i);
    await expect(getDoc(sectionDocRef(db, OWNER, 'settings'))).rejects.toThrow(/permission/i);
  });

  it('cannot write, edit or delete the owner data', async () => {
    await seedOwner();
    const db = await storeAs(STRANGER);

    await expect(setDoc(doc(userCollectionRef(db, OWNER, 'datasets'), datasetRow().id), datasetRow().data)).rejects.toThrow(/permission/i);
    await expect(updateDoc(userDocRef(db, OWNER), { fullName: 'Stolen' })).rejects.toThrow(/permission/i);
    await expect(deleteDoc(doc(userCollectionRef(db, OWNER, 'datasets'), datasetRow().id))).rejects.toThrow(/permission/i);
  });
});

describe('firestore.rules — outside the account tree', () => {
  it('is denied even to a signed-in owner', async () => {
    const db = await storeAs(OWNER);

    await expect(setDoc(doc(db, 'admin', 'flags'), { on: true })).rejects.toThrow(/permission/i);
    await expect(getDocs(collection(db, 'admin'))).rejects.toThrow(/permission/i);
  });
});