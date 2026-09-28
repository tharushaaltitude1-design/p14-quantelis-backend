import { createContext, useContext } from 'react';
import type { WorkspaceAction, WorkspaceState } from './workspaceReducer';

export const WorkspaceStateContext = createContext<WorkspaceState | null>(null);
export const WorkspaceDispatchContext = createContext<React.Dispatch<WorkspaceAction> | null>(null);

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
