import { describe, expect, it } from 'vitest';
import { createFreshWorkspace, initialWorkspaceState, workspaceReducer, type WorkspaceState } from '../workspaceReducer';
import {
  adoptOrder,
  buildDelta,
  createOrderBook,
  deepEqual,
  isEmptyDelta,
  mergeHydration,
  persistedSlices,
  persistableProfile,
  persistableSettings,
  rollbackPatch,
  type OrderBook,
  type WorkspaceHydration,
} from '../workspaceSync';
import { WORKSPACE_COLLECTIONS } from '@/services/workspaceRepo';

/** An order book primed from the seeded state, the way a first snapshot would. */
function primedBook(state: WorkspaceState = initialWorkspaceState): OrderBook {
  const book = createOrderBook();
  for (const name of WORKSPACE_COLLECTIONS) {
    adoptOrder(book, name, state[name].map((item, index) => ({ id: item.id, ord: index })));
  }
  return book;
}

const NEW_DATASET = {
  name: 'New feed',
  source: 'CSV upload',
  rows: '1,000',
  variables: 4,
  status: 'Needs review' as const,
  quality: 90,
  columns: [],
};

describe('buildDelta', () => {
  it('writes nothing for a purely local action', () => {
    const book = primedBook();
    const next = workspaceReducer(initialWorkspaceState, { type: 'toast/push', toast: { kind: 'info', title: 'Hi' } });
    // Toasts and counters are UI state and must never reach the database.
    expect(isEmptyDelta(buildDelta(initialWorkspaceState, next, book))).toBe(true);
  });

  it('writes only the document that changed', () => {
    const book = primedBook();
    const target = initialWorkspaceState.projects[0];
    const after = workspaceReducer(initialWorkspaceState, { type: 'project/recordRun', id: target.id, runs: 43, confidence: 94 });

    const delta = buildDelta(initialWorkspaceState, after, book);

    // One project document plus the activity entry the reducer logged — and nothing else.
    expect(delta.writes.filter((write) => write.collection === 'projects')).toHaveLength(1);
    expect(delta.writes.filter((write) => write.collection === 'datasets')).toHaveLength(0);
    expect(delta.writes.filter((write) => write.collection === 'scenarios')).toHaveLength(0);
  });

  it('writes the renamed field on a dataset and leaves the other datasets alone', () => {
    const book = primedBook();
    const target = initialWorkspaceState.datasets[0];
    const after = workspaceReducer(initialWorkspaceState, { type: 'dataset/rename', id: target.id, name: 'Renamed' });

    const delta = buildDelta(initialWorkspaceState, after, book);
    const renamed = delta.writes.find((write) => write.collection === 'datasets');

    expect(delta.writes.filter((write) => write.collection === 'datasets')).toHaveLength(1);
    expect(renamed?.id).toBe(target.id);
    expect(renamed?.data.name).toBe('Renamed');
    // The rename also logs an activity entry, which is the only other write this action causes.
    expect(delta.writes.filter((write) => write.collection === 'activity')).toHaveLength(1);
  });

  it('emits a delete for a removed document and keeps the rest untouched', () => {
    const book = primedBook();
    const target = initialWorkspaceState.scenarios[0];
    const after = workspaceReducer(initialWorkspaceState, { type: 'scenario/delete', id: target.id });

    const delta = buildDelta(initialWorkspaceState, after, book);

    expect(delta.deletes).toEqual([{ collection: 'scenarios', id: target.id }]);
    // The activity entry the reducer logged is a real document too.
    expect(delta.writes.map((write) => write.collection)).toContain('activity');
    expect(delta.writes.some((write) => write.collection === 'scenarios')).toBe(false);
  });

  it('gives a prepended document a sort key below everything already stored', () => {
    const book = primedBook();
    const after = workspaceReducer(initialWorkspaceState, { type: 'dataset/add', dataset: NEW_DATASET });

    const delta = buildDelta(initialWorkspaceState, after, book);
    const added = delta.writes.find((write) => write.id === after.datasets[0].id);
    const storedOrds = [...book.datasets.values()].filter((ord) => ord !== added?.ord);

    // Firestore returns documents in id order, so a prepend has to carry a lower `ord` to stay
    // at the front of the list on the next read.
    expect(added?.ord).toBeLessThan(Math.min(...storedOrds));
  });

  it('keeps existing sort keys stable across repeated edits', () => {
    const book = primedBook();
    const target = initialWorkspaceState.datasets[1];
    const originalOrd = book.datasets.get(target.id);

    const renamed = workspaceReducer(initialWorkspaceState, { type: 'dataset/rename', id: target.id, name: 'Again' });
    buildDelta(initialWorkspaceState, renamed, book);

    expect(book.datasets.get(target.id)).toBe(originalOrd);
  });

  it('never rewrites the activity trail in place', () => {
    const book = primedBook();
    const after = workspaceReducer(initialWorkspaceState, { type: 'dataset/rename', id: initialWorkspaceState.datasets[0].id, name: 'X' });

    const delta = buildDelta(initialWorkspaceState, after, book);
    const activityWrites = delta.writes.filter((write) => write.collection === 'activity');

    // Exactly one entry is appended; the existing log is not re-sent. `firestore.rules` denies
    // updates on this collection, so a spurious rewrite would be rejected outright.
    expect(activityWrites).toHaveLength(1);
  });
});

describe('persisted sections', () => {
  it('excludes the API-key reveal toggle', () => {
    const revealed = { ...initialWorkspaceState.settings, revealApiKey: true };
    expect(Object.keys(persistableSettings(revealed))).not.toContain('revealApiKey');

    const delta = buildDelta(initialWorkspaceState, { ...initialWorkspaceState, settings: revealed }, primedBook());
    expect(Object.keys(delta.sections.settings ?? {})).not.toContain('revealApiKey');
  });

  it('persists settings that do change', () => {
    const renamed = { ...initialWorkspaceState.settings, name: 'Acme Forecast' };
    const delta = buildDelta(initialWorkspaceState, { ...initialWorkspaceState, settings: renamed }, primedBook());

    expect(delta.sections.settings?.name).toBe('Acme Forecast');
  });

  it('mirrors the whole identity profile, so the account reads the same on any device', () => {
    const synced = {
      ...initialWorkspaceState.profile,
      fullName: 'Alex Rivera',
      email: 'alex@example.com',
      initials: 'AR',
      photoURL: 'https://example.test/a.png',
      jobRole: 'Energy Analyst',
    };

    const fields = persistableProfile(synced);

    expect(fields).toEqual({
      fullName: 'Alex Rivera',
      email: 'alex@example.com',
      initials: 'AR',
      photoURL: 'https://example.test/a.png',
      jobRole: 'Energy Analyst',
      department: synced.department,
    });
  });

  it('keeps a null avatar null rather than storing an empty string', () => {
    // Firestore distinguishes null from "", and the rules allow only `string or null` here, so this
    // must not normalise the value on the way out.
    const fields = persistableProfile({ ...initialWorkspaceState.profile, photoURL: null });

    expect(fields.photoURL).toBeNull();
  });

  it('does not rewrite the profile when nothing about it changed', () => {
    const delta = buildDelta(initialWorkspaceState, { ...initialWorkspaceState }, primedBook());

    // `profile/syncIdentity` runs on every sign-in; writing on each one would be pure churn, so
    // the diff has to be silent when the identity that arrived matches what is already held.
    expect(delta.sections.profile).toBeUndefined();
  });

  it('does rewrite the profile when the display name is corrected', () => {
    const renamed = { ...initialWorkspaceState.profile, fullName: 'Alex R.' };
    const delta = buildDelta(initialWorkspaceState, { ...initialWorkspaceState, profile: renamed }, primedBook());

    expect(delta.sections.profile?.fullName).toBe('Alex R.');
  });
});

describe('rollbackPatch', () => {
  it('reverts only the collections the failed write touched', () => {
    const before = initialWorkspaceState;
    const renamedDataset = workspaceReducer(before, { type: 'dataset/rename', id: before.datasets[0].id, name: 'Rolled back' });
    const alsoRenamed = workspaceReducer(renamedDataset, { type: 'dataset/rename', id: before.datasets[1].id, name: 'Also here' });

    const datasetDelta = buildDelta(before, renamedDataset, primedBook(before));
    const patch = rollbackPatch(before, datasetDelta);
    const restored = { ...alsoRenamed, ...patch };

    // The dataset write failed, so it reverts...
    expect(restored.datasets).toBe(before.datasets);
    // ...but the unrelated second rename, which is not in this delta, survives.
    expect(restored.datasets).not.toBe(alsoRenamed.datasets);
  });

  it('reverts a section that was part of the write', () => {
    const before = initialWorkspaceState;
    const after = workspaceReducer(before, { type: 'settings/update', changes: { plan: 'Enterprise' } });
    const delta = buildDelta(before, after, primedBook(before));

    expect(delta.sections.settings).toBeDefined();
    expect(rollbackPatch(before, delta).settings).toBe(before.settings);
  });

  it('leaves toasts and counters alone', () => {
    const before = initialWorkspaceState;
    const after = workspaceReducer(before, { type: 'dataset/delete', id: before.datasets[0].id });
    const patch = rollbackPatch(before, buildDelta(before, after, primedBook(before)));

    expect(patch).not.toHaveProperty('toasts');
    expect(patch).not.toHaveProperty('seq');
  });
});

describe('mergeHydration', () => {
  it('treats an empty collection as an empty dashboard, not as "no data"', () => {
    const merged = mergeHydration(initialWorkspaceState, { datasets: [], projects: [], scenarios: [] });

    // This is what makes a brand-new account blank instead of showing the demo fixtures.
    expect(merged.datasets).toEqual([]);
    expect(merged.projects).toEqual([]);
    expect(merged.scenarios).toEqual([]);
  });

  it('never restores a revealed API key from storage', () => {
    // Cast because this is exactly what the database can hand back: an untyped snapshot from a
    // document written before the key was excluded, or by a hand-edited console entry. The type
    // stops our own code from writing it; the merge has to survive it regardless.
    const stored = { ...initialWorkspaceState.settings, revealApiKey: true, name: 'Stored name' } as WorkspaceHydration['settings'];
    const merged = mergeHydration(initialWorkspaceState, { settings: stored });

    expect(merged.settings?.revealApiKey).toBe(false);
    expect(merged.settings?.name).toBe('Stored name');
  });

  it('layers a partial profile over the identity Auth already provided', () => {
    const signedIn: WorkspaceState = {
      ...initialWorkspaceState,
      profile: { ...initialWorkspaceState.profile, email: 'alex@example.com', initials: 'AR', photoURL: null },
    };

    const merged = mergeHydration(signedIn, {
      profile: { fullName: 'Alex Rivera', email: 'alex@example.com', jobRole: 'Energy Analyst', department: 'Ops', initials: 'AR', photoURL: null },
    });

    expect(merged.profile).toMatchObject({ email: 'alex@example.com', initials: 'AR', jobRole: 'Energy Analyst' });
  });
});

describe('adoptOrder', () => {
  it('uses the stored sort key when it is a number', () => {
    const book = createOrderBook();
    adoptOrder(book, 'datasets', [{ id: 'a', ord: 7 }, { id: 'b', ord: 2 }]);

    expect(book.datasets.get('a')).toBe(7);
    expect(book.datasets.get('b')).toBe(2);
  });

  it('falls back to the snapshot order when a document has no usable sort key', () => {
    const book = createOrderBook();
    adoptOrder(book, 'datasets', [{ id: 'a', ord: Number.NaN }, { id: 'b', ord: Number.NaN }]);

    expect(book.datasets.get('a')).toBe(0);
    expect(book.datasets.get('b')).toBe(1);
  });

  it('drops keys for documents that are gone, so ids are not reused across accounts', () => {
    const book = primedBook();
    adoptOrder(book, 'datasets', [{ id: 'fresh', ord: 0 }]);

    expect(book.datasets.has(initialWorkspaceState.datasets[0].id)).toBe(false);
    expect(book.datasets.get('fresh')).toBe(0);
  });
});

describe('createFreshWorkspace', () => {
  it('starts a new account with no documents at all', () => {
    const fresh = createFreshWorkspace({ displayName: 'New Person', email: 'new@example.com' });

    for (const name of WORKSPACE_COLLECTIONS) expect(fresh[name]).toEqual([]);
    expect(fresh.activity).toEqual([]);
    expect(fresh.notifications).toEqual([]);
  });

  it('never inherits the demo workspace name', () => {
    const fresh = createFreshWorkspace({ displayName: 'New Person', email: 'new@example.com' });

    expect(fresh.settings.name).toBe("New Person's workspace");
    expect(fresh.settings.name).not.toBe(initialWorkspaceState.settings.name);
  });

  it('falls back to the email local part when the account has no display name', () => {
    expect(createFreshWorkspace({ displayName: null, email: 'sam@example.com' }).settings.name).toBe("sam's workspace");
    expect(createFreshWorkspace({ displayName: '  ', email: null }).settings.name).toBe('My workspace');
  });

  it('carries the account identity across so the shell is not blank', () => {
    const fresh = createFreshWorkspace({ displayName: 'New Person', email: 'new@example.com' });

    expect(fresh.profile.email).toBe('new@example.com');
    expect(fresh.profile.fullName).toBe('New Person');
  });
});

describe('persistedSlices', () => {
  it('excludes the state that must never be written to the database', () => {
    const slices = persistedSlices({ ...initialWorkspaceState, toasts: [{ id: 't1', kind: 'info', title: 'x' }], seq: 9, toastSeq: 4 });

    expect(Object.keys(slices).sort()).toEqual([...WORKSPACE_COLLECTIONS, 'profile', 'security', 'settings'].sort());
    expect(slices).not.toHaveProperty('toasts');
    expect(slices).not.toHaveProperty('seq');
    expect(slices).not.toHaveProperty('sessions');
  });
});

describe('deepEqual', () => {
  it('compares nested objects and arrays by value', () => {
    expect(deepEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] })).toBe(true);
    expect(deepEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 3 }] })).toBe(false);
    expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(deepEqual(null, undefined)).toBe(false);
    expect(deepEqual([1, 2], { 0: 1, 1: 2 })).toBe(false);
  });
});