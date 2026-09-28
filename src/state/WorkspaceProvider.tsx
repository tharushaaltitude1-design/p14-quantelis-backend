import { useMemo, useReducer, type ReactNode } from 'react';
import { WorkspaceDispatchContext, WorkspaceStateContext } from './workspaceContext';
import { initialWorkspaceState, workspaceReducer } from './workspaceReducer';

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(workspaceReducer, initialWorkspaceState);
  // The dispatch function is stable, but memoising the context objects avoids a
  // re-render of every consumer on each unrelated state change.
  const stateValue = useMemo(() => state, [state]);
  return (
    <WorkspaceStateContext.Provider value={stateValue}>
      <WorkspaceDispatchContext.Provider value={dispatch}>{children}</WorkspaceDispatchContext.Provider>
    </WorkspaceStateContext.Provider>
  );
}
