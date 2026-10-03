import {
  collection,
  doc,
  getDoc,
  getDocs,
  writeBatch,
  type DocumentData,
  type Firestore,
  type QueryDocumentSnapshot,
  type WriteBatch,
} from 'firebase/firestore';
import type { WorkspaceHydration } from '@/state/workspaceSync';
import type {
  ActivityEntry,
  Dataset,
  NotificationItem,
  ProfileDetails,
  Project,
  Scenario,
  SecurityState,
  TeamMember,
  WorkspaceSettings,
} from '@/data/mock';

/**
 * Every Firestore document the dashboard reads or writes lives under `users/{uid}`:
 *
 *   users/{uid}                        -> profile (identity mirror, seededAt, schemaVersion)
 *   users/{uid}/settings/current       -> WorkspaceSettings
 *   users/{uid}/security/current       -> SecurityState
 *   users/{uid}/datasets/{datasetId}   -> Dataset
 *   users/{uid}/projects/{projectId}   -> Project
 *   users/{uid}/scenarios/{scenarioId} -> Scenario
 *   users/{uid}/activity/{entryId}     -> ActivityEntry   (append-only audit trail)
 *   users/{uid}/notifications/{noteId} -> NotificationItem
 *   users/{uid}/team/{memberId}        -> TeamMember
 *   users/{uid}/meta/seed              -> the seed marker, see seedWorkspace.ts
 *
 * Owner-scoping rather than a shared-workspace tree is deliberate: an account owns its data
 * outright, so `firestore.rules` only has to answer one question - is the caller this uid? - and a
 * brand-new sign-up starts from a known-empty tree rather than from a migration.
 *
 * Two Firestore path rules shape this layout, and both are easy to get wrong:
 *
 *   1. A *document* path needs an even number of segments, a *collection* path an odd one. So
 *      `users/{uid}/settings` (three) is invalid, and settings live at
 *      `users/{uid}/settings/current` (four) instead. `users/{uid}` is two segments, so it is a
 *      document and may carry subcollections.
 *   2. Settings and security are single values, not lists, so they get a fixed document id
 *      (`current`) rather than being crammed into the profile document. That keeps the profile
 *      document free to grow the identity mirror and the seed marker, and it makes a settings write
 *      a merge that cannot clobber the profile.
 *
 * Every collection document carries one field beyond its domain shape:
 *
 *   ord - the display sort key
 *
 * `ord` is not optional. `getDocs` on a bare collection returns documents in document-id order, and
 * ids like "d1" or "p3-mf3k2j" do not sort into the order the UI wants (newest first), so the
 * client stores an explicit sort key and reads back in that order.
 *
 * This module deliberately knows nothing about seeding: it exposes reads, writes and refs, and
 * `seedWorkspace.ts` composes them. Keeping the dependency one-way (seed -> repo) avoids a cycle
 * between the two, which would otherwise leave `SCHEMA_VERSION` undefined at module-init time.
 */

export const USERS_ROOT = 'users';

/** Subcollections that hold a list of domain objects. */
export const WORKSPACE_COLLECTIONS = [
  'datasets',
  'projects',
  'scenarios',
  'activity',
  'notifications',
  'team',
] as const;

export type WorkspaceCollectionName = (typeof WORKSPACE_COLLECTIONS)[number];

/** Maps each collection name to the item type it stores. */
export type WorkspaceCollections = {
  datasets: Dataset;
  projects: Project;
  scenarios: Scenario;
  activity: ActivityEntry;
  notifications: NotificationItem;
  team: TeamMember;
};

/**
 * The profile fields that are stored. Everything else on `ProfileDetails` is owned by Firebase Auth
 * and mirrored into the store at runtime, so persisting it would only cache a value that can go
 * stale.
 */
export type PersistableProfile = Pick<ProfileDetails, 'fullName' | 'email' | 'jobRole' | 'department' | 'initials' | 'photoURL'>;

/**
 * `settings` deliberately omits `revealApiKey`. That flag is a view toggle - whether the workspace
 * API key is currently uncovered on screen - so persisting it would reveal the key to whoever next
 * opens the dashboard, on any machine. `firestore.rules` rejects the field outright, and
 * `sanitizeSettings` always reports it as hidden.
 */
export type WorkspaceSections = {
  settings: Omit<WorkspaceSettings, 'revealApiKey'>;
  security: SecurityState;
  profile: PersistableProfile;
};

export type WorkspaceSectionName = keyof WorkspaceSections;

export type OrderedItem<T> = { item: T; ord: number };

/** Firestore's hard cap on operations in a single batch. */
const MAX_BATCH_OPS = 400;

type DocumentKey = { collection: WorkspaceCollectionName; id: string };

export type PersistDelta = {
  writes: Array<DocumentKey & { data: DocumentData; ord: number }>;
  deletes: DocumentKey[];
  /** Each section goes to its own document; see `applyDelta`. */
  sections: Partial<Record<WorkspaceSectionName, DocumentData>>;
};

export const emptyDelta = (): PersistDelta => ({ writes: [], deletes: [], sections: {} });

// ---------------------------------------------------------------------------
// Refs
// ---------------------------------------------------------------------------

/** `users/{uid}` - the profile document. Two segments, so it is a document. */
export function userDocRef(db: Firestore, uid: string) {
  return doc(db, USERS_ROOT, uid);
}

export function userCollectionRef(db: Firestore, uid: string, name: WorkspaceCollectionName) {
  return collection(db, USERS_ROOT, uid, name);
}

/** Fixed document id for the single-value sections. */
export const CURRENT_DOC = 'current';

export function sectionDocRef(db: Firestore, uid: string, name: 'settings' | 'security') {
  return doc(db, USERS_ROOT, uid, name, CURRENT_DOC);
}

/** `users/{uid}/meta/seed` - the marker that says this account's seed state is settled. */
export function seedMarkerRef(db: Firestore, uid: string) {
  return doc(db, USERS_ROOT, uid, 'meta', 'seed');
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

export function toError(cause: unknown): Error {
  return cause instanceof Error ? cause : new Error(String(cause));
}

/** Strips the storage-only `ord` field and normalises the id. */
function toOrderedItem<T extends { id?: unknown }>(snap: QueryDocumentSnapshot<DocumentData>): OrderedItem<T> {
  const { ord: storedOrd, ...rest } = snap.data() as DocumentData;
  return {
    item: { ...(rest as T), id: snap.id },
    ord: typeof storedOrd === 'number' && Number.isFinite(storedOrd) ? storedOrd : 0,
  };
}

/** Newest first: a higher `ord` was created later, which is how the demo screens are ordered. */
function sortByOrd<T extends { id: string }>(items: Array<OrderedItem<T>>): Array<OrderedItem<T>> {
  return [...items].sort((a, b) => b.ord - a.ord || a.item.id.localeCompare(b.item.id));
}

async function readCollection<T extends { id: string }>(
  db: Firestore,
  uid: string,
  name: WorkspaceCollectionName,
): Promise<Array<OrderedItem<T>>> {
  const snapshot = await getDocs(userCollectionRef(db, uid, name));
  return sortByOrd(snapshot.docs.map((entry) => toOrderedItem<T>(entry)));
}

/**
 * Turns a stored document back into valid domain values.
 *
 * Documents are written by this app, but they are also editable by hand in the Firebase console and
 * by any future importer, so a field that is missing or the wrong type falls back to a sane default
 * rather than reaching a screen and crashing it.
 */
function str(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function sanitizeSettings(raw: DocumentData): WorkspaceSettings {
  const notifications = (raw.notifications ?? {}) as Record<string, unknown>;
  return {
    name: str(raw.name) ?? 'My workspace',
    timezone: str(raw.timezone) ?? 'UTC',
    currency: str(raw.currency) ?? 'USD - US Dollar',
    notifications: Object.fromEntries(Object.entries(notifications).map(([key, entry]) => [key, entry === true])),
    // Never restored from storage, whatever the document says.
    revealApiKey: false,
    marketFeedConnected: raw.marketFeedConnected === true,
    plan: str(raw.plan) ?? 'Team',
  };
}

export function sanitizeSecurity(raw: DocumentData): SecurityState {
  return { twoFactorEnabled: raw.twoFactorEnabled === true };
}

/**
 * Returns null when the stored profile has no name, which keeps the neutral in-memory baseline in
 * place rather than blanking out a signed-in user.
 */
export function sanitizeProfile(raw: DocumentData): PersistableProfile | null {
  const fullName = str(raw.fullName);
  if (!fullName) return null;
  return {
    fullName,
    email: typeof raw.email === 'string' ? raw.email : '',
    jobRole: str(raw.jobRole) ?? '',
    department: str(raw.department) ?? '',
    initials: str(raw.initials) ?? '',
    photoURL: typeof raw.photoURL === 'string' ? raw.photoURL : null,
  };
}

/** The sort keys a collection's documents were stored with, which is all the order book needs. */
export type StoredOrder = Array<{ id: string; ord: number }>;

/** The collections and sections read from Firestore, plus the seed marker that came with them. */
export type WorkspaceRead = {
  hydration: WorkspaceHydration;
  /** Stored sort keys per collection, so a newly created document gets one that fits in. */
  order: Record<WorkspaceCollectionName, StoredOrder>;
  /** `schemaVersion` from the seed marker, or undefined when the marker is absent. */
  seededVersion: number | undefined;
};

/**
 * Reads the whole workspace in one round of parallel requests.
 *
 * A deliberate choice over `onSnapshot`: a refused subscription reports the error and then simply
 * never delivers a value, so a rules problem shows up as an empty dashboard rather than as a
 * failure. A single `await` either resolves with the data or throws, which keeps those two states
 * distinct and lets the caller show the error instead of an empty screen.
 */
export async function readWorkspace(db: Firestore, uid: string): Promise<WorkspaceRead> {
  const [marker, profileSnap, settingsSnap, securitySnap, datasets, projects, scenarios, activity, notifications, team] =
    await Promise.all([
      getDoc(seedMarkerRef(db, uid)),
      getDoc(userDocRef(db, uid)),
      getDoc(sectionDocRef(db, uid, 'settings')),
      getDoc(sectionDocRef(db, uid, 'security')),
      readCollection<Dataset>(db, uid, 'datasets'),
      readCollection<Project>(db, uid, 'projects'),
      readCollection<Scenario>(db, uid, 'scenarios'),
      readCollection<ActivityEntry>(db, uid, 'activity'),
      readCollection<NotificationItem>(db, uid, 'notifications'),
      readCollection<TeamMember>(db, uid, 'team'),
    ]);

  const keys = (items: Array<OrderedItem<{ id: string }>>): StoredOrder =>
    items.map((entry) => ({ id: entry.item.id, ord: entry.ord }));

  return {
    hydration: {
      datasets: datasets.map((entry) => entry.item),
      projects: projects.map((entry) => entry.item),
      scenarios: scenarios.map((entry) => entry.item),
      activity: activity.map((entry) => entry.item),
      notifications: notifications.map((entry) => entry.item),
      team: team.map((entry) => entry.item),
      settings: settingsSnap.exists() ? sanitizeSettings(settingsSnap.data() as DocumentData) : undefined,
      security: securitySnap.exists() ? sanitizeSecurity(securitySnap.data() as DocumentData) : undefined,
      profile: profileSnap.exists() ? (sanitizeProfile(profileSnap.data() as DocumentData) ?? undefined) : undefined,
    },
    order: {
      datasets: keys(datasets),
      projects: keys(projects),
      scenarios: keys(scenarios),
      activity: keys(activity),
      notifications: keys(notifications),
      team: keys(team),
    },
    seededVersion: marker.exists() ? ((marker.data() as DocumentData).schemaVersion as number | undefined) : undefined,
  };
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

/**
 * Applies a delta in as few round trips as possible.
 *
 * Firestore caps a batch at 400 operations, so a large sweep is split across several commits rather
 * than being rejected wholesale. Sections are merged rather than overwritten, which is what makes a
 * partial write safe: changing one setting cannot remove the others.
 */
export async function applyDelta(db: Firestore, uid: string, delta: PersistDelta): Promise<void> {
  const ops = [
    ...delta.writes.map((write) => ({
      apply: (batch: WriteBatch) =>
        batch.set(doc(db, USERS_ROOT, uid, write.collection, write.id), { ...write.data, ord: write.ord }),
    })),
    ...delta.deletes.map((removal) => ({
      apply: (batch: WriteBatch) => batch.delete(doc(db, USERS_ROOT, uid, removal.collection, removal.id)),
    })),
    ...(delta.sections.profile
      ? [{ apply: (batch: WriteBatch) => batch.set(userDocRef(db, uid), delta.sections.profile, { merge: true }) }]
      : []),
    ...(delta.sections.settings
      ? [{ apply: (batch: WriteBatch) => batch.set(sectionDocRef(db, uid, 'settings'), delta.sections.settings, { merge: true }) }]
      : []),
    ...(delta.sections.security
      ? [{ apply: (batch: WriteBatch) => batch.set(sectionDocRef(db, uid, 'security'), delta.sections.security, { merge: true }) }]
      : []),
  ];

  for (let index = 0; index < ops.length; index += MAX_BATCH_OPS) {
    const batch = writeBatch(db);
    for (const op of ops.slice(index, index + MAX_BATCH_OPS)) op.apply(batch);
    await batch.commit();
  }
}

/**
 * Deletes every dataset, project, scenario, activity entry, notification, teammate and single-value
 * document under `users/{uid}`.
 *
 * The caller is responsible for writing the seed marker afterwards, so that an emptied workspace is
 * not immediately refilled on the next load. `delete` on a document that does not exist resolves
 * without error, so this is safe to run twice.
 */
export async function clearWorkspace(db: Firestore, uid: string): Promise<void> {
  for (const name of WORKSPACE_COLLECTIONS) {
    const snapshot = await getDocs(userCollectionRef(db, uid, name));
    if (snapshot.empty) continue;

    for (let index = 0; index < snapshot.docs.length; index += MAX_BATCH_OPS) {
      const batch = writeBatch(db);
      for (const docSnapshot of snapshot.docs.slice(index, index + MAX_BATCH_OPS)) batch.delete(docSnapshot.ref);
      await batch.commit();
    }
  }

  const batch = writeBatch(db);
  batch.delete(sectionDocRef(db, uid, 'settings'));
  batch.delete(sectionDocRef(db, uid, 'security'));
  await batch.commit();
}