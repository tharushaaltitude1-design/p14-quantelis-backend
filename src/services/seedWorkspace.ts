import { doc, writeBatch, type Firestore } from 'firebase/firestore';
import {
  activity as demoActivity,
  datasets as demoDatasets,
  notifications as demoNotifications,
  profile as demoProfile,
  projects as demoProjects,
  scenarios as demoScenarios,
  security as demoSecurity,
  settings as demoSettings,
  team as demoTeam,
} from '@/data/mock';
import { persistableProfile, persistableSettings, type WorkspaceHydration } from '@/state/workspaceSync';
import {
  USERS_ROOT,
  WORKSPACE_COLLECTIONS,
  sectionDocRef,
  seedMarkerRef,
  userDocRef,
  type PersistableProfile,
  type WorkspaceCollectionName,
} from './workspaceRepo';

/**
 * Demo-data seeding.
 *
 * The fixtures in `@/data/mock` used to be the app's permanent data source. They are now only a
 * starting point: this module fills a workspace with them exactly once, so every screen is
 * exercised against genuine Firestore reads and writes rather than against an array in memory.
 *
 * It runs in the browser as the signed-in user, so it needs no service-account key, no
 * `firebase-admin`, and no way to leak an admin credential into the repository.
 *
 * ## The seed marker
 *
 * `users/{uid}/meta/seed` records that this account's seed state has been *decided*, and carries
 * the `schemaVersion` the decision was made at. That one document is what makes the whole thing
 * behave:
 *
 *   - absent      the account has never been settled, so seed it (or mark it deliberately empty
 *                 when demo content is disabled)
 *   - present     leave it alone, whatever it contains. This is what lets "clear workspace" stick:
 *                 a cleared workspace has a marker with `seeded: false`, so the next load does not
 *                 quietly put the fixtures back.
 *   - stale       the document shape has changed, so seed again
 *
 * Bumping `SCHEMA_VERSION` therefore re-seeds every existing account, which is the intended way to
 * ship a change to the stored shape.
 *
 * Document ids come from each fixture's own `id`, so re-running overwrites the same documents
 * rather than duplicating them, and two tabs racing cannot produce two copies.
 *
 * ## Why it is one batch
 *
 * Rules that inspect another document (`get()`, `exists()`) only see committed state, never writes
 * travelling alongside them in the same transaction. The rules in `firestore.rules` check nothing
 * beyond ownership, so the seed does not need to be split into a profile write followed by a data
 * write - and doing it in one batch means an interrupted seed writes nothing at all rather than a
 * profile with no data.
 */

/** Bumped whenever the shape of a stored document changes. */
export const SCHEMA_VERSION = 1;

const COLLECTION_FIXTURES: Record<WorkspaceCollectionName, Array<Record<string, unknown>>> = {
  datasets: demoDatasets as unknown as Array<Record<string, unknown>>,
  projects: demoProjects as unknown as Array<Record<string, unknown>>,
  scenarios: demoScenarios as unknown as Array<Record<string, unknown>>,
  activity: demoActivity as unknown as Array<Record<string, unknown>>,
  notifications: demoNotifications as unknown as Array<Record<string, unknown>>,
  team: demoTeam as unknown as Array<Record<string, unknown>>,
};

/**
 * Only the profile fields Auth does not model, plus the identity mirror. Shares its allowlist with
 * the live persistence path so the two cannot drift apart.
 */
function seededProfile(): PersistableProfile {
  return persistableProfile(demoProfile);
}

/**
 * Reuses `persistableSettings` rather than spreading the fixture, so the seed writes exactly the
 * shape the live app persists - in particular no `revealApiKey`, which `firestore.rules` rejects.
 */
function seededSettings() {
  return persistableSettings(demoSettings);
}

/** What the fixtures look like as stored documents, for display next to the seeding controls. */
export const demoSeedSummary = [
  ...WORKSPACE_COLLECTIONS.map((name) => ({ label: name, count: COLLECTION_FIXTURES[name].length })),
  { label: 'settings', count: 1 },
  { label: 'security', count: 1 },
  { label: 'profile', count: 1 },
] as const;

export const demoSeedDocumentCount =
  WORKSPACE_COLLECTIONS.reduce((sum, name) => sum + COLLECTION_FIXTURES[name].length, 0) + 3;

export type SeedResult = { documents: number };

/**
 * The hydrated state the seed produces.
 *
 * Returned rather than re-read from Firestore: the marker was absent, so every collection was
 * empty, so what was just written is exactly this. Merging it in place saves the round trip.
 */
export function buildFixtureHydration(): WorkspaceHydration {
  const sections = {
    settings: seededSettings(),
    security: { ...demoSecurity },
    profile: seededProfile(),
  };

  return {
    datasets: demoDatasets,
    projects: demoProjects,
    scenarios: demoScenarios,
    activity: demoActivity,
    notifications: demoNotifications,
    team: demoTeam,
    ...sections,
  };
}

/**
 * Builds the write set for a full demo workspace, without committing it.
 *
 * Exported so the shape can be asserted in tests - the rules in `firestore.rules` validate these
 * documents field by field, and a fixture that grows a field has to be a visible failure.
 */
export function buildSeedRows(): Array<{ collection: WorkspaceCollectionName; id: string; data: Record<string, unknown>; ord: number }> {
  const rows: Array<{ collection: WorkspaceCollectionName; id: string; data: Record<string, unknown>; ord: number }> = [];

  for (const name of WORKSPACE_COLLECTIONS) {
    COLLECTION_FIXTURES[name].forEach((item, index) => {
      const { id, ...fields } = item;
      rows.push({ collection: name, id: String(id), data: { id, ...fields }, ord: index });
    });
  }

  return rows;
}

/** Writes the marker that settles an account's seed state. */
export async function writeSeedMarker(db: Firestore, uid: string, seeded: boolean): Promise<void> {
  await writeBatch(db)
    .set(seedMarkerRef(db, uid), { schemaVersion: SCHEMA_VERSION, seeded, completedAt: Date.now() })
    .commit();
}

/** Writes the demo fixtures and the marker in one batch. */
export async function writeFixtureSeed(db: Firestore, uid: string, identity: PersistableProfile): Promise<SeedResult> {
  const batch = writeBatch(db);
  const rows = buildSeedRows();

  for (const row of rows) {
    batch.set(doc(db, USERS_ROOT, uid, row.collection, row.id), { ...row.data, ord: row.ord });
  }

  batch.set(sectionDocRef(db, uid, 'settings'), seededSettings());
  batch.set(sectionDocRef(db, uid, 'security'), { ...demoSecurity });
  batch.set(
    userDocRef(db, uid),
    { ...identity, createdAt: Date.now(), seededAt: Date.now(), schemaVersion: SCHEMA_VERSION },
    { merge: true },
  );
  batch.set(seedMarkerRef(db, uid), { schemaVersion: SCHEMA_VERSION, seeded: true, completedAt: Date.now() });

  await batch.commit();

  return { documents: rows.length + 4 };
}

export type SeedOutcome = 'created' | 'already-seeded' | 'marked-empty';