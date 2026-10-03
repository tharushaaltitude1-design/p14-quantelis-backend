import { describe, expect, it } from 'vitest';
import { doc, getFirestore } from 'firebase/firestore';
import { initializeApp } from 'firebase/app';
import { initialWorkspaceState, workspaceReducer } from '../workspaceReducer';
import { persistedSlices } from '../workspaceSync';
import { buildFixtureHydration, buildSeedRows } from '@/services/seedWorkspace';
import {
  sanitizeProfile,
  sanitizeSecurity,
  sanitizeSettings,
  sectionDocRef,
  seedMarkerRef,
  userCollectionRef,
  userDocRef,
  WORKSPACE_COLLECTIONS,
} from '@/services/workspaceRepo';

describe('workspace paths', () => {
  // Firestore rejects a document reference whose path has an odd number of segments, and it does so
  // by throwing inside the provider's render — which is a black screen rather than a test failure.
  // Asserting the shape here is the only cheap guard against reintroducing that path layout.
  // `doc()` and `collection()` are pure factories, so a real instance is built offline and no
  // network call is made.
  const db = getFirestore(initializeApp({ apiKey: 'test', projectId: 'path-shape-test' }, 'path-shape-test'));

  it('addresses the account document with an even number of segments', () => {
    expect(() => userDocRef(db, 'u1')).not.toThrow();
    expect(userDocRef(db, 'u1').path).toBe('users/u1');
  });

  it('addresses every subcollection as a collection, with a document path inside it', () => {
    for (const name of WORKSPACE_COLLECTIONS) {
      const ref = userCollectionRef(db, 'u1', name);
      expect(() => doc(ref, 'item-1')).not.toThrow();
      expect(doc(ref, 'item-1').path).toBe(`users/u1/${name}/item-1`);
    }
  });

  it('would have caught the three-segment section documents this replaced', () => {
    // Guards the regression itself: `users/{uid}/settings` has three segments and throws.
    expect(() => doc(db, 'users', 'u1', 'settings')).toThrow(/even number of segments/);
  });

  it('files the single values under their own subcollection as `current`', () => {
    // The reason the three-segment path above is unusable: a value has no id of its own, so it has
    // to live in a collection of one. `current` keeps the reference project's path shape.
    expect(sectionDocRef(db, 'u1', 'settings').path).toBe('users/u1/settings/current');
    expect(sectionDocRef(db, 'u1', 'security').path).toBe('users/u1/security/current');
  });

  it('keeps the seed marker out of the way in meta/', () => {
    expect(seedMarkerRef(db, 'u1').path).toBe('users/u1/meta/seed');
  });
});

describe('workspace/hydrate', () => {
  it('applies a snapshot without marking the store ready', () => {
    // `hydrated` belongs to `workspace/ready` alone, so the dashboard stays behind the skeleton
    // until the whole first round of snapshots has landed.
    const after = workspaceReducer(initialWorkspaceState, { type: 'workspace/hydrate', payload: { datasets: [] } });

    expect(after.datasets).toEqual([]);
    expect(after.hydrated).toBe(false);
  });

  it('leaves the slices a snapshot does not carry alone', () => {
    const after = workspaceReducer(initialWorkspaceState, { type: 'workspace/hydrate', payload: { projects: [] } });

    expect(after.projects).toEqual([]);
    expect(after.datasets).toBe(initialWorkspaceState.datasets);
  });

  it('does not let a snapshot clobber toasts or counters', () => {
    const withToast = workspaceReducer(initialWorkspaceState, { type: 'toast/push', toast: { kind: 'info', title: 'Saved' } });
    const after = workspaceReducer(withToast, { type: 'workspace/hydrate', payload: persistedSlices(initialWorkspaceState) });

    expect(after.toasts).toHaveLength(1);
    expect(after.toasts[0].title).toBe('Saved');
    expect(after.toastSeq).toBe(1);
  });
});

describe('workspace/ready', () => {
  it('marks the store usable and is idempotent', () => {
    const once = workspaceReducer(initialWorkspaceState, { type: 'workspace/ready' });
    expect(once.hydrated).toBe(true);
    // Re-running it must not produce a new object, or the shell re-renders for nothing.
    expect(workspaceReducer(once, { type: 'workspace/ready' })).toBe(once);
  });
});

describe('workspace/restore', () => {
  it('puts back a slice after a rejected write', () => {
    const renamed = workspaceReducer(initialWorkspaceState, { type: 'dataset/rename', id: initialWorkspaceState.datasets[0].id, name: 'Nope' });
    const after = workspaceReducer(renamed, { type: 'workspace/restore', patch: { datasets: initialWorkspaceState.datasets } });

    expect(after.datasets).toBe(initialWorkspaceState.datasets);
    expect(after.datasets[0].name).not.toBe('Nope');
  });

  it('leaves the sync error flag for the banner to clear', () => {
    const failed = workspaceReducer(initialWorkspaceState, { type: 'workspace/syncError', message: 'permission-denied' });
    const after = workspaceReducer(failed, { type: 'workspace/restore', patch: { datasets: [] } });

    expect(after.syncError).toBe('permission-denied');
    expect(workspaceReducer(after, { type: 'workspace/syncError', message: null }).syncError).toBeNull();
  });
});

describe('sanitizers', () => {
  it('always reports the API key as hidden, whatever the document says', () => {
    expect(sanitizeSettings({ name: 'Acme', revealApiKey: true, notifications: { 'Weekly summary': true } })).toMatchObject({
      name: 'Acme',
      revealApiKey: false,
    });
  });

  it('fills in defaults for fields a hand-edited settings document is missing', () => {
    expect(sanitizeSettings({})).toMatchObject({ name: 'My workspace', marketFeedConnected: false });
  });

  it('coerces notification preferences to real booleans', () => {
    expect(sanitizeSettings({ notifications: { a: 'yes', b: true, c: 1 } }).notifications).toEqual({
      a: false,
      b: true,
      c: false,
    });
  });

  it('omits a profile with no name, so the neutral baseline is kept', () => {
    expect(sanitizeProfile({ jobRole: 'Analyst' })).toBeNull();
    expect(sanitizeProfile({ fullName: 'Alex', jobRole: 'Analyst' })).toMatchObject({ fullName: 'Alex' });
  });

  it('keeps a null avatar rather than turning it into an empty string', () => {
    expect(sanitizeProfile({ fullName: 'Alex', photoURL: null })?.photoURL).toBeNull();
  });

  it('treats any non-true value as disabled for two-factor auth', () => {
    expect(sanitizeSecurity({ twoFactorEnabled: 'true' })).toEqual({ twoFactorEnabled: false });
    expect(sanitizeSecurity({ twoFactorEnabled: true })).toEqual({ twoFactorEnabled: true });
  });
});

describe('buildSeedRows', () => {
  it('writes every fixture exactly once, with a sort key', () => {
    const rows = buildSeedRows();

    for (const name of WORKSPACE_COLLECTIONS) {
      const mine = rows.filter((row) => row.collection === name);
      const ids = mine.map((row) => row.id);
      expect(new Set(ids).size).toBe(ids.length);
      mine.forEach((row) => expect(typeof row.ord).toBe('number'));
    }
  });

  it('orders each seeded collection the way the demo screens expect', () => {
    const datasets = buildSeedRows()
      .filter((row) => row.collection === 'datasets')
      .sort((a, b) => a.ord - b.ord);

    expect(datasets.map((row) => row.id)).toEqual(['d1', 'd2', 'd3', 'd4', 'd5', 'd6']);
  });

  it('never seeds a revealed API key', () => {
    const settings = buildFixtureHydration().settings;

    expect(settings).toBeDefined();
    expect(settings).not.toHaveProperty('revealApiKey');
  });

  it('mirrors the Auth-owned identity fields alongside the extras', () => {
    expect(Object.keys(buildFixtureHydration().profile ?? {}).sort()).toEqual([
      'department',
      'email',
      'fullName',
      'initials',
      'jobRole',
      'photoURL',
    ]);
  });

  it('is idempotent, so re-seeding cannot duplicate documents', () => {
    const first = buildSeedRows();
    const second = buildSeedRows();

    expect(second.map((row) => `${row.collection}/${row.id}`)).toEqual(first.map((row) => `${row.collection}/${row.id}`));
  });

  /**
   * `firestore.rules` validates every stored document field by field with `hasOnly`, so a fixture
   * that grows a field makes the rules refuse the whole seed. The list below is the rules' own
   * allowlist, duplicated here on purpose: it fails the moment the two drift apart, and the failure
   * names the collection rather than surfacing as a permission-denied toast at runtime.
   */
  const RULES_FIELDS: Record<string, string[]> = {
    datasets: ['columns', 'name', 'quality', 'rows', 'source', 'status', 'updated', 'variables'],
    projects: ['confidence', 'dataset', 'horizon', 'lastRun', 'name', 'runs', 'status', 'variable'],
    scenarios: ['name', 'objective', 'params', 'project', 'score'],
    activity: ['detail', 'ref', 'status', 'time', 'title', 'type'],
    notifications: ['read', 'text', 'time', 'title', 'to'],
    team: ['invited', 'jobTitle', 'name', 'role'],
  };

  it('stays within the field lists firestore.rules allows', () => {
    for (const row of buildSeedRows()) {
      const allowed = new Set([...RULES_FIELDS[row.collection], 'id', 'ord']);
      const extra = Object.keys(row.data).filter((key) => !allowed.has(key));

      expect(extra, `${row.collection}/${row.id} has fields the rules reject: ${extra.join(', ')}`).toEqual([]);
    }
  });
});