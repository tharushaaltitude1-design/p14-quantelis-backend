import { createContext, useContext } from 'react';
import type { WorkspaceAction, WorkspaceState } from './workspaceReducer';

export const WorkspaceStateContext = createContext<WorkspaceState | null>(null);
export const WorkspaceDispatchContext = createContext<React.Dispatch<WorkspaceAction> | null>(null);

/**
 * Bulk database operations, kept out of `WorkspaceState` on purpose.
 *
 * Seeding and clearing are not state transitions: they rewrite the database and only then tell the
 * store what happened. Putting them on the dispatch context would mean routing them through the
 * reducer as if a user action produced them, and putting them on the state context would mean
 * putting a function in the object every screen re-renders on. A separate context keeps both
 * honest, and keeps the reference stable for the ~20 components that only read state.
 */
export type WorkspaceMode = 'seed' | 'clear';

export const WorkspaceResetContext = createContext<((mode: WorkspaceMode) => Promise<void>) | null>(null);

export function useWorkspace(): WorkspaceState {
  const state = useContext(WorkspaceStateContext);
  if (!state) throw new Error('useWorkspace must be used inside <WorkspaceProvider>');
  return state;
}

export function useWorkspaceDispatch(): React.Dispatch<WorkspaceAction> {
  const dispatch = useContext(WorkspaceDispatchContext);
  if (!dispatch) throw new Error('useWorkspaceDispatch must be used inside <WorkspaceProvider>');
  return dispatch;
}

/** Wipes the account's Firestore data and re-seeds it, or wipes it for good. */
export function useWorkspaceReset(): (mode: WorkspaceMode) => Promise<void> {
  const reset = useContext(WorkspaceResetContext);
  if (!reset) throw new Error('useWorkspaceReset must be used inside <WorkspaceProvider>');
  return reset;
}