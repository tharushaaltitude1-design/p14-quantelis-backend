import { useCallback, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from 'react';
import { db, isFirestoreEnabled } from '@/lib/firestore';
import { applyDelta, clearWorkspace, readWorkspace, toError, WORKSPACE_COLLECTIONS, type StoredOrder, type WorkspaceCollectionName } from '@/services/workspaceRepo';
import {
  SCHEMA_VERSION,
  buildFixtureHydration,
  writeFixtureSeed,
  writeSeedMarker,
} from '@/services/seedWorkspace';
import { AuthContext } from './authContext';
import { WorkspaceDispatchContext, WorkspaceResetContext, WorkspaceStateContext } from './workspaceContext';
import { createFreshWorkspace, initialWorkspaceState, workspaceReducer, type WorkspaceAction } from './workspaceReducer';
import { adoptOrder, buildDelta, createOrderBook, isEmptyDelta, persistedSlices, rollbackPatch, type OrderBook } from './workspaceSync';

/**
 * The workspace store, backed by Cloud Firestore.
 *
 * The reducer stays synchronous and is still what decides what the UI shows. This provider adds the
 * two things a real database needs around it:
 *
 *   load     On sign-in, read the whole workspace in one parallel round. If the account has never
 *            been seeded, write the demo fixtures immediately so a brand-new account has something
 *            real to show. The dashboard renders behind `hydrated` until that finishes, so a user
 *            can never edit data that is about to be replaced by a snapshot.
 *
 *   persist  Each dispatch is reduced locally first (instant and optimistic), then the previous and
 *            next state are diffed into a minimal write set. A rejected write rolls the store back
 *            to its last known-good value and raises a toast, so the UI cannot silently drift away
 *            from the database.
 *
 * There is no live subscription. A refused `onSnapshot` reports the error and then simply never
 * delivers a value, which makes a rules problem indistinguishable from an empty account - exactly
 * the failure that made this unusable. A single `await` either resolves with the data or throws, so
 * the two cases stay distinct and the error is shown instead of a blank dashboard.
 *
 * `useContext` is used instead of `useAuth` so the provider still works when rendered on its own,
 * which the reducer tests rely on. With no signed-in account — or no Firebase config at all — it
 * degrades to the bundled fixtures and marks itself ready immediately.
 */

/**
 * Demo content may only be written when the build explicitly opts in. Defaults to on in dev so a
 * fresh clone can be exercised, and off everywhere else, which is what stops demo records appearing
 * in a production workspace.
 */
const demoEnabled = import.meta.env.DEV || import.meta.env.VITE_USE_MOCK_DATA === 'true';

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const auth = useContext(AuthContext);
  const uid = auth?.user?.uid ?? null;

  const [state, baseDispatch] = useReducer(workspaceReducer, initialWorkspaceState);

  // The auth `User` is a live object, so the identity fields are captured as primitives and are
  // only used to seed the profile document.
  const displayName = auth?.user?.displayName ?? null;
  const email = auth?.user?.email ?? null;

  // Mirrors the latest state so `dispatch` can diff prev -> next without waiting for a render. It
  // is also updated synchronously inside `dispatch`, so two dispatches in one tick diff correctly
  // against each other rather than both against a stale snapshot of state.
  const stateRef = useRef(state);
  const uidRef = useRef(uid);
  uidRef.current = uid;

  // Sort keys for the persisted collections. Deliberately outside state: they are storage metadata
  // that no screen renders, and keeping them out avoids re-rendering the tree when one changes.
  const orderBook = useRef<OrderBook>(createOrderBook());

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const dispatch = useCallback((action: WorkspaceAction) => {
    const prev = stateRef.current;
    const next = workspaceReducer(prev, action);
    stateRef.current = next;
    baseDispatch(action);

    // Nothing to persist before the first read completes, and no database at all in demo mode.
    const currentUid = uidRef.current;
    if (!currentUid || !db || !isFirestoreEnabled || !prev.hydrated) return;

    const delta = buildDelta(prev, next, orderBook.current);
    if (isEmptyDelta(delta)) return;

    void applyDelta(db, currentUid, delta).then(
      () => {
        // Only clear the banner if a newer failure has not already set it.
        if (stateRef.current.syncError !== null) baseDispatch({ type: 'workspace/syncError', message: null });
      },
      (cause: unknown) => {
        const error = toError(cause);
        // Revert only what this write touched, so an unrelated optimistic update that landed in
        // the same frame is not thrown away with it.
        baseDispatch({ type: 'workspace/restore', patch: rollbackPatch(prev, delta) });
        baseDispatch({ type: 'workspace/syncError', message: error.message });
        baseDispatch({
          type: 'toast/push',
          toast: { kind: 'danger', title: 'Change not saved', message: `${error.message} The change was rolled back.` },
        });
      },
    );
  }, []);

  // Load and settle. Re-runs on sign-in, sign-out and any change of account.
  useEffect(() => {
    if (!uid || !db || !isFirestoreEnabled) {
      // No database or no account: keep the bundled fixtures and become usable at once, so a
      // fresh clone and the unit tests both render without waiting on a read.
      baseDispatch({ type: 'workspace/ready' });
      return;
    }

    let cancelled = false;

    // Reset to the neutral baseline before the read so a workspace belonging to a previous account
    // can never flash on screen for the next one.
    const baseline = createFreshWorkspace({ displayName, email });
    baseDispatch({ type: 'workspace/hydrate', payload: persistedSlices(baseline) });

    (async () => {
      try {
        const { hydration, order, seededVersion } = await readWorkspace(db, uid);
        if (cancelled) return;

        // Adopt the stored sort keys before storing the items, so the next diff assigns new
        // documents keys relative to what is really in the database.
        for (const [name, items] of Object.entries(order) as Array<[WorkspaceCollectionName, StoredOrder]>) {
          adoptOrder(orderBook.current, name, items);
        }

        if (seededVersion === SCHEMA_VERSION) {
          // Settled already: whatever is stored is what the account should see.
          baseDispatch({ type: 'workspace/hydrate', payload: hydration });
          baseDispatch({ type: 'workspace/ready' });
          return;
        }

        if (!demoEnabled) {
          // A deployment that must never contain demo records gets an empty workspace, marked as
          // settled so the decision is not retaken on every load.
          await writeSeedMarker(db, uid, false);
          if (cancelled) return;
          baseDispatch({ type: 'workspace/hydrate', payload: hydration });
          baseDispatch({ type: 'workspace/ready' });
          return;
        }

        const identity = {
          fullName: displayName ?? '',
          email: email ?? '',
          jobRole: '',
          department: '',
          initials: '',
          photoURL: null,
        };

        await writeFixtureSeed(db, uid, identity);
        if (cancelled) return;

        // The marker was absent, so every collection read above was empty. What was just written is
        // therefore exactly the fixture set, and using it directly saves a second round trip.
        for (const name of WORKSPACE_COLLECTIONS) adoptOrder(orderBook.current, name, []);
        baseDispatch({ type: 'workspace/hydrate', payload: buildFixtureHydration() });
        baseDispatch({ type: 'workspace/ready' });
      } catch (cause) {
        if (cancelled) return;
        const error = toError(cause);
        baseDispatch({ type: 'workspace/syncError', message: error.message });
        baseDispatch({
          type: 'toast/push',
          toast: { kind: 'danger', title: 'Could not load your workspace', message: error.message },
        });
        // Ready regardless: an account that cannot be read still has to render something, and the
        // persistent banner is what explains why it is empty.
        baseDispatch({ type: 'workspace/ready' });
      }
    })();

    return () => {
      cancelled = true;
      orderBook.current = createOrderBook();
    };
  }, [uid, displayName, email]);

  /**
   * Empties the workspace and re-seeds it, or empties it for good.
   *
   * Exposed through the Settings > Data screen rather than through dispatch, because it is not a
   * state transition: it is a bulk rewrite of the database that has to land before the store is
   * told about it.
   */
  const resetWorkspace = useCallback(
    async (mode: 'seed' | 'clear') => {
      const currentUid = uidRef.current;
      if (!currentUid || !db || !isFirestoreEnabled) return;

      await clearWorkspace(db, currentUid);

      if (mode === 'clear') {
        // The marker is what stops the next load from putting the fixtures straight back.
        await writeSeedMarker(db, currentUid, false);
        const empty = createFreshWorkspace({ displayName, email });
        baseDispatch({ type: 'workspace/hydrate', payload: persistedSlices(empty) });
        return;
      }

      await writeFixtureSeed(db, currentUid, {
        fullName: displayName ?? '',
        email: email ?? '',
        jobRole: '',
        department: '',
        initials: '',
        photoURL: null,
      });
      for (const name of WORKSPACE_COLLECTIONS) adoptOrder(orderBook.current, name, []);
      baseDispatch({ type: 'workspace/hydrate', payload: buildFixtureHydration() });
    },
    [displayName, email],
  );

  const value = useMemo(() => state, [state]);

  return (
    <WorkspaceStateContext.Provider value={value}>
      <WorkspaceResetContext.Provider value={resetWorkspace}>
        <WorkspaceDispatchContext.Provider value={dispatch}>{children}</WorkspaceDispatchContext.Provider>
      </WorkspaceResetContext.Provider>
    </WorkspaceStateContext.Provider>
  );
}