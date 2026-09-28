import { describe, expect, it } from 'vitest';
import {
  initialWorkspaceState,
  workspaceReducer,
  totalRuns,
  meanAccuracy,
  unreadCount,
  datasetRowTotal,
  adminCount,
  MAX_TOASTS,
  type WorkspaceState,
} from '../workspaceReducer';
import { WorkspaceProvider } from '../WorkspaceProvider';
import { useWorkspace, useWorkspaceDispatch } from '../workspaceContext';
import { act, renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';

const setup = () => {
  const wrapper = ({ children }: { children: ReactNode }) => createElement(WorkspaceProvider, null, children);
  return renderHook(() => ({ state: useWorkspace(), dispatch: useWorkspaceDispatch() }), { wrapper });
};

describe('workspaceReducer', () => {
  it('adds a dataset and logs the activity', () => {
    const before = initialWorkspaceState;
    const after = workspaceReducer(before, {
      type: 'dataset/add',
      dataset: { name: 'New feed', source: 'CSV upload', rows: '1,000', variables: 4, status: 'Needs review', quality: 90, columns: [] },
    });

    expect(after.datasets).toHaveLength(before.datasets.length + 1);
    expect(after.datasets[0].name).toBe('New feed');
    expect(after.activity[0].detail).toBe('Dataset uploaded');
    // The original state must not be mutated.
    expect(before.datasets).toHaveLength(after.datasets.length - 1);
  });

  it('renames a dataset without touching the others', () => {
    const id = initialWorkspaceState.datasets[0].id;
    const after = workspaceReducer(initialWorkspaceState, { type: 'dataset/rename', id, name: 'Renamed' });
    expect(after.datasets.find((d) => d.id === id)?.name).toBe('Renamed');
    expect(after.datasets.filter((d) => d.name === 'Renamed')).toHaveLength(1);
  });

  it('deletes a dataset and records it', () => {
    const id = initialWorkspaceState.datasets[0].id;
    const after = workspaceReducer(initialWorkspaceState, { type: 'dataset/delete', id });
    expect(after.datasets.some((d) => d.id === id)).toBe(false);
    expect(after.activity[0].detail).toBe('Dataset deleted');
  });

  it('duplicates a project as a draft instead of a live run', () => {
    const source = initialWorkspaceState.projects[0];
    const after = workspaceReducer(initialWorkspaceState, { type: 'project/duplicate', id: source.id });
    const copy = after.projects[0];
    expect(copy.name).toBe(`${source.name} (copy)`);
    expect(copy.status).toBe('Draft');
    expect(copy.runs).toBe(0);
    expect(after.projects).toHaveLength(initialWorkspaceState.projects.length + 1);
  });

  it('increments run counts when a forecast is recorded', () => {
    const target = initialWorkspaceState.projects[0];
    const after = workspaceReducer(initialWorkspaceState, { type: 'project/recordRun', id: target.id, runs: target.runs + 1, confidence: 95 });
    const updated = after.projects.find((p) => p.id === target.id);
    expect(updated?.runs).toBe(target.runs + 1);
    expect(updated?.confidence).toBe(95);
  });

  it('adds, updates and deletes scenarios', () => {
    const added = workspaceReducer(initialWorkspaceState, {
      type: 'scenario/add',
      scenario: { name: 'Stress test', project: 'Grid Load Peak Forecast', params: '+20% demand', objective: 'Minimize risk', score: 71 },
    });
    expect(added.scenarios[0].name).toBe('Stress test');

    const id = added.scenarios[0].id;
    const updated = workspaceReducer(added, { type: 'scenario/update', id, changes: { score: 80 } });
    expect(updated.scenarios.find((s) => s.id === id)?.score).toBe(80);

    const removed = workspaceReducer(updated, { type: 'scenario/delete', id });
    expect(removed.scenarios.some((s) => s.id === id)).toBe(false);
  });

  it('marks notifications read individually and all at once', () => {
    const target = initialWorkspaceState.notifications[0];
    const one = workspaceReducer(initialWorkspaceState, { type: 'notification/read', id: target.id });
    expect(one.notifications.find((n) => n.id === target.id)?.read).toBe(true);
    expect(unreadCount(one.notifications)).toBe(unreadCount(initialWorkspaceState.notifications) - 1);

    const all = workspaceReducer(one, { type: 'notification/readAll' });
    expect(unreadCount(all.notifications)).toBe(0);
  });

  it('toggles a notification preference', () => {
    const key = 'Weekly workspace summary';
    const before = initialWorkspaceState.settings.notifications[key];
    const after = workspaceReducer(initialWorkspaceState, { type: 'settings/toggleNotification', key });
    expect(after.settings.notifications[key]).toBe(!before);
  });

  it('invites a member and changes roles', () => {
    const invited = workspaceReducer(initialWorkspaceState, { type: 'team/invite', name: 'Priya Raman', jobTitle: 'Analyst', role: 'Viewer' });
    const member = invited.team[invited.team.length - 1];
    expect(member).toMatchObject({ name: 'Priya Raman', role: 'Viewer', invited: true });

    const promoted = workspaceReducer(invited, { type: 'team/setRole', id: member.id, role: 'Analyst' });
    expect(promoted.team.find((m) => m.id === member.id)?.role).toBe('Analyst');
  });

  it('revokes a session but keeps the current device', () => {
    const remote = initialWorkspaceState.sessions.find((s) => !s.current);
    expect(remote).toBeDefined();
    const after = workspaceReducer(initialWorkspaceState, { type: 'session/revoke', id: remote!.id });
    expect(after.sessions.some((s) => s.id === remote!.id)).toBe(false);
    expect(after.sessions.some((s) => s.current)).toBe(true);
  });

  it('queues and dismisses toasts, capping the visible stack and keeping ids unique', () => {
    let state: WorkspaceState = initialWorkspaceState;
    for (let i = 0; i < 6; i += 1) {
      state = workspaceReducer(state, { type: 'toast/push', toast: { kind: 'info', title: `Toast ${i}` } });
    }
    // Only the four most recent survive the cap.
    expect(state.toasts).toHaveLength(MAX_TOASTS);
    expect(state.toasts.map((t) => t.title)).toEqual(['Toast 2', 'Toast 3', 'Toast 4', 'Toast 5']);
    // Trimming the stack must not reuse an id, otherwise one dismiss removes two toasts.
    expect(new Set(state.toasts.map((t) => t.id)).size).toBe(MAX_TOASTS);

    const dismissed = workspaceReducer(state, { type: 'toast/dismiss', id: state.toasts[0].id });
    expect(dismissed.toasts).toHaveLength(MAX_TOASTS - 1);
    expect(dismissed.toasts.some((t) => t.id === state.toasts[0].id)).toBe(false);
  });

  it('recomputes derived selectors from state', () => {
    const state = initialWorkspaceState;
    expect(totalRuns(state.projects)).toBe(state.projects.reduce((sum, p) => sum + p.runs, 0));
    expect(adminCount(state)).toBe(state.team.filter((m) => m.role === 'Admin').length);
    expect(datasetRowTotal(state)).toBeGreaterThan(0);
    expect(meanAccuracy(state)).toBeGreaterThan(0);
    // Draft projects are excluded from the accuracy average.
    expect(meanAccuracy(state)).toBeCloseTo(
      state.projects.filter((p) => p.status !== 'Draft').reduce((sum, p) => sum + p.confidence, 0) / state.projects.filter((p) => p.status !== 'Draft').length,
    );
  });

  it('updates the profile', () => {
    const after = workspaceReducer(initialWorkspaceState, { type: 'profile/update', changes: { fullName: 'Alex Rivera', department: 'Ops' } });
    expect(after.profile.fullName).toBe('Alex Rivera');
    expect(after.profile.department).toBe('Ops');
  });
});

describe('WorkspaceProvider', () => {
  it('exposes state and dispatch, and persists a change across renders', () => {
    const { result } = setup();
    expect(result.current.state.datasets.length).toBeGreaterThan(0);

    const before = result.current.state.projects.length;
    act(() => {
      result.current.dispatch({ type: 'project/duplicate', id: initialWorkspaceState.projects[0].id });
    });

    expect(result.current.state.projects).toHaveLength(before + 1);
    expect(result.current.state.projects[0].name).toContain('(copy)');
  });
});
