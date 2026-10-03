import type { Dataset, NotificationItem, ProfileDetails, Project, Scenario, TeamMember, WorkspaceSettings } from '@/data/mock';
import {
  WORKSPACE_COLLECTIONS,
  emptyDelta,
  type PersistableProfile,
  type PersistDelta,
  type WorkspaceCollectionName,
  type WorkspaceCollections,
  type WorkspaceSectionName,
  type WorkspaceSections,
} from '@/services/workspaceRepo';
import type { WorkspaceState } from './workspaceReducer';

/**
 * Turns store transitions into Firestore writes.
 *
 * The store stays a plain synchronous `useReducer`, and this module is the only thing that knows
 * a database exists. Two properties make that work:
 *
 *   1. Every dispatch is reduced locally first, then `buildDelta` compares the previous state to
 *      the next one and emits writes *only* for documents that actually changed. Firestore bills
 *      per write, so re-sending an unchanged 60-entry activity log on every action would be both
 *      slow and expensive.
 *   2. List order is persisted as an explicit `ord` sort key, tracked in an `OrderBook` outside
 *      the domain types. Firestore returns documents in document-id order, which does not match
 *      the newest-first order the screens expect.
 *
 * Everything here is pure with respect to the store, so the interesting behaviour is testable
 * without a live Firebase project.
 */

/** Slice of state that mirrors a Firestore collection. */
export type PersistedCollections = Pick<WorkspaceState, WorkspaceCollectionName>;

/** Sort keys per collection, keyed by document id. Rebuilt from every snapshot. */
export type OrderBook = Record<WorkspaceCollectionName, Map<string, number>>;

export function createOrderBook(): OrderBook {
  return Object.fromEntries(WORKSPACE_COLLECTIONS.map((name) => [name, new Map<string, number>()])) as OrderBook;
}

/**
 * Rebuilds a collection's sort keys from a snapshot.
 *
 * Falls back to the snapshot's own array index when a document carries no usable `ord`, so a
 * hand-written or imported collection still comes back in a stable order.
 */
export function adoptOrder<K extends WorkspaceCollectionName>(book: OrderBook, name: K, items: Array<{ id: string; ord: number }>): void {
  const next = new Map<string, number>();
  items.forEach((item, index) => {
    next.set(item.id, Number.isFinite(item.ord) ? item.ord : index);
  });
  book[name] = next;
}

/**
 * Next sort key for a newly created document.
 *
 * Counts downward from the current minimum so a prepend always lands at the front without having
 * to renumber the documents already stored.
 */
function allocateOrd(known: Map<string, number>): number {
  let min = 0;
  for (const ord of known.values()) min = Math.min(min, ord);
  return min - 1;
}

export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((value, index) => deepEqual(value, b[index]));
  }

  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const keys = Object.keys(left);
  if (keys.length !== Object.keys(right).length) return false;
  return keys.every((key) => key in right && deepEqual(left[key], right[key]));
}

// ---------------------------------------------------------------------------
// Single-document state
// ---------------------------------------------------------------------------

/**
 * An explicit allowlist of the settings that are persisted.
 *
 * Two reasons it is spelled out rather than derived:
 *   - `revealApiKey` is a view toggle, not a setting. Persisting it would reveal the workspace API
 *     key to whoever next opens the dashboard, on any machine.
 *   - A field added to `WorkspaceSettings` later does not silently start being written to the
 *     database before someone has decided that it should be.
 */
export function persistableSettings(settings: WorkspaceSettings): WorkspaceSections['settings'] {
  return {
    name: settings.name,
    timezone: settings.timezone,
    currency: settings.currency,
    notifications: settings.notifications,
    marketFeedConnected: settings.marketFeedConnected,
    plan: settings.plan,
  };
}

/**
 * The profile fields that are stored.
 *
 * `email`, `initials` and `photoURL` are owned by Firebase Auth, so they are written as a *mirror*
 * rather than as a source of truth: `useProfileSync` keeps overwriting them from the signed-in
 * account on every load, which is why a stale copy cannot stick. Keeping the mirror means the
 * Firestore profile document is a complete record of the account, the way the reference project's
 * `users/{uid}` is.
 */
export function persistableProfile(profile: ProfileDetails): PersistableProfile {
  return {
    fullName: profile.fullName,
    email: profile.email,
    jobRole: profile.jobRole,
    department: profile.department,
    initials: profile.initials,
    photoURL: profile.photoURL,
  };
}

export function buildSectionDelta(prev: WorkspaceState, next: WorkspaceState): Partial<Record<WorkspaceSectionName, Record<string, unknown>>> {
  const sections: Partial<Record<WorkspaceSectionName, Record<string, unknown>>> = {};

  const settings = persistableSettings(next.settings);
  if (!deepEqual(persistableSettings(prev.settings), settings)) sections.settings = settings;

  const profile = persistableProfile(next.profile);
  if (!deepEqual(persistableProfile(prev.profile), profile)) sections.profile = profile;

  if (!deepEqual(prev.security, next.security)) sections.security = { ...next.security };

  return sections;
}

// ---------------------------------------------------------------------------
// Collections
// ---------------------------------------------------------------------------

function itemsOf<K extends WorkspaceCollectionName>(state: PersistedCollections, name: K): WorkspaceCollections[K][] {
  return state[name] as WorkspaceCollections[K][];
}

/**
 * Compares one collection before and after a transition.
 *
 * `book` is mutated as a side effect: newly seen ids get a sort key and removed ids are
 * forgotten, so the book stays in step with the store across any number of dispatches.
 */
function diffCollection<K extends WorkspaceCollectionName>(
  book: OrderBook,
  name: K,
  before: WorkspaceCollections[K][],
  after: WorkspaceCollections[K][],
  delta: PersistDelta,
): void {
  const known = book[name];
  const beforeById = new Map(before.map((item) => [item.id, item]));

  for (const item of after) {
    const previous = beforeById.get(item.id);
    if (!known.has(item.id)) known.set(item.id, allocateOrd(known));
    // An existing document whose fields are unchanged needs no write at all.
    if (previous && deepEqual(previous, item)) continue;

    const { id, ...fields } = item;
    delta.writes.push({ collection: name, id, data: { id, ...fields }, ord: known.get(item.id) ?? 0 });
  }

  const afterIds = new Set(after.map((item) => item.id));
  for (const item of before) {
    if (afterIds.has(item.id)) continue;
    known.delete(item.id);
    delta.deletes.push({ collection: name, id: item.id });
  }
}

/**
 * Builds the full write set for a transition.
 *
 * Pure with respect to the store; the only mutation is the caller-supplied `OrderBook`.
 */
export function buildDelta(prev: WorkspaceState, next: WorkspaceState, book: OrderBook): PersistDelta {
  const delta = emptyDelta();

  for (const name of WORKSPACE_COLLECTIONS) {
    diffCollection(book, name, itemsOf(prev, name), itemsOf(next, name), delta);
  }

  delta.sections = buildSectionDelta(prev, next);
  return delta;
}

export function isEmptyDelta(delta: PersistDelta): boolean {
  return delta.writes.length === 0 && delta.deletes.length === 0 && Object.keys(delta.sections).length === 0;
}

/**
 * The store slice to put back when a write is rejected.
 *
 * Only what the failed delta actually touched is reverted, so an unrelated optimistic update that
 * landed in the same frame survives the rollback.
 */
export function rollbackPatch(prev: WorkspaceState, delta: PersistDelta): Partial<WorkspaceState> {
  const patch: Partial<WorkspaceState> = {};

  // Indexed through a widened view on purpose: writing `patch[name]` with `name` typed as a union
  // makes TypeScript demand an intersection of every possible value type, which nothing satisfies.
  const writable = patch as Record<string, unknown>;

  const touched = new Set<WorkspaceCollectionName>([...delta.writes, ...delta.deletes].map((entry) => entry.collection));
  for (const name of touched) writable[name] = prev[name];

  for (const name of Object.keys(delta.sections) as WorkspaceSectionName[]) {
    writable[name] = prev[name];
  }

  return patch;
}

// ---------------------------------------------------------------------------
// Hydration
// ---------------------------------------------------------------------------

/**
 * One slice of a snapshot, or absent when that subscription has not reported yet.
 *
 * Written as an explicit mapped type rather than `Partial<A> & Partial<B>`: intersecting two
 * partials collapses the value types into an intersection (`Dataset[] & TeamMember[]`), which
 * nothing can satisfy.
 *
 * `profile` is deliberately the *stored* shape — three fields — not the full `ProfileDetails`.
 * A snapshot never carries email, initials or the avatar, and typing it as if it did is what let
 * a partial document through as if it were complete.
 */
export type WorkspaceHydration = {
  [K in WorkspaceCollectionName]?: WorkspaceState[K];
} & {
  // Stored sections, not store sections: settings arrive without `revealApiKey`, because that flag
  // describes what the current browser is showing and is never persisted.
  settings?: WorkspaceSections['settings'];
  security?: WorkspaceState['security'];
  profile?: WorkspaceSections['profile'];
};

/**
 * A hydration payload after it has been resolved against the current state, and is therefore
 * typed in store terms rather than storage terms. Keeping the two apart is what stops a stored
 * three-field profile from being spread into `WorkspaceState` as if it were complete.
 */
export type WorkspaceResolvedSlices = {
  [K in WorkspaceCollectionName]?: WorkspaceState[K];
} & {
  settings?: WorkspaceState['settings'];
  security?: WorkspaceState['security'];
  profile?: WorkspaceState['profile'];
};

/**
 * Picks just the persisted slices out of a full store state.
 *
 * Used to reset to a fresh baseline. Spreading the whole state into `workspace/hydrate` would be a
 * bug: the reducer merges its payload over the current state, so `toasts`, `seq` and the sync
 * flags would all be overwritten by whatever the baseline happened to carry.
 */
export function persistedSlices(state: WorkspaceState): WorkspaceHydration {
  const slices: WorkspaceHydration = {};
  const writable = slices as Record<string, unknown>;
  for (const name of WORKSPACE_COLLECTIONS) writable[name] = state[name];
  writable.settings = state.settings;
  writable.profile = state.profile;
  writable.security = state.security;
  return slices;
}

/**
 * Merges one snapshot into state.
 *
 * Snapshots arrive per-collection, so each carries only its own slice. An empty collection is a
 * real answer — it means the collection is empty in Firestore — and is applied as an empty list
 * rather than skipped. That is how a new account gets a genuinely blank dashboard instead of the
 * bundled demo fixtures.
 */
export function mergeHydration(state: WorkspaceState, incoming: WorkspaceHydration): WorkspaceResolvedSlices {
  // Built slice by slice rather than spread from `incoming`: a spread would carry the *stored*
  // profile type straight through, and the three fields a profile document holds are not enough
  // to satisfy `ProfileDetails`.
  const merged: WorkspaceResolvedSlices = {};
  // Widened view for the loop below: writing `merged[name]` with `name` typed as a union of
  // collection names makes TypeScript demand an intersection of every array type, which nothing
  // can satisfy.
  const writable = merged as Record<string, unknown>;

  for (const name of WORKSPACE_COLLECTIONS) {
    const items = incoming[name];
    if (items !== undefined) writable[name] = items;
  }

  if (incoming.settings) {
    // A revealed API key must never come back from storage, whatever the document says.
    merged.settings = { ...state.settings, ...incoming.settings, revealApiKey: false };
  }

  if (incoming.profile) {
    // Identity fields stay owned by Firebase Auth, so `useProfileSync` keeps winning on
    // fullName / email / initials / photoURL and only the extras come from storage.
    merged.profile = { ...state.profile, ...incoming.profile };
  }

  if (incoming.security) {
    merged.security = { ...state.security, ...incoming.security };
  }

  return merged;
}

/** Re-exported so callers can name the stored item types without importing the repo. */
export type { Dataset, Project, Scenario, NotificationItem, TeamMember, WorkspaceCollectionName, PersistDelta };