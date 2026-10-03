import {
  activity as seedActivity, datasets as seedDatasets, notifications as seedNotifications, profile as seedProfile,
  projects as seedProjects, scenarios as seedScenarios, security as seedSecurity, sessions as seedSessions,
  settings as seedSettings, team as seedTeam,
  type ActivityEntry, type Dataset, type DatasetStatus, type NotificationItem, type ProfileDetails, type Project,
  type ProjectStatus, type Scenario, type SecurityState, type Session, type Status, type TeamMember, type WorkspaceRole,
  type WorkspaceSettings,
} from '@/data/mock';
import { mergeHydration, type WorkspaceHydration } from './workspaceSync';

export type ToastKind = 'info' | 'success' | 'danger';

export type Toast = { id: string; kind: ToastKind; title: string; message?: string };

export type WorkspaceState = {
  datasets: Dataset[];
  projects: Project[];
  scenarios: Scenario[];
  activity: ActivityEntry[];
  notifications: NotificationItem[];
  team: TeamMember[];
  sessions: Session[];
  settings: WorkspaceSettings;
  profile: ProfileDetails;
  security: SecurityState;
  toasts: Toast[];
  seq: number;
  /** Monotonic counter for toasts, so ids stay unique after the stack is capped. */
  toastSeq: number;
  /**
   * False until the first round of Firestore snapshots has landed (or until the app decides it
   * has no database and should keep the local seed). The dashboard gates on this so a user can
   * never edit data that is about to be replaced by a snapshot.
   */
  hydrated: boolean;
  /** Last persistence failure, surfaced in the shell so a silent write loss cannot go unnoticed. */
  syncError: string | null;
};

export type NewDataset = Pick<Dataset, 'name' | 'source' | 'rows' | 'variables' | 'status' | 'quality' | 'columns'>;
export type NewProject = Pick<Project, 'name' | 'dataset' | 'variable' | 'horizon' | 'confidence' | 'runs'>;
export type NewScenario = Pick<Scenario, 'name' | 'project' | 'params' | 'objective' | 'score'>;

export type WorkspaceAction =
  | { type: 'dataset/add'; dataset: NewDataset }
  | { type: 'dataset/rename'; id: string; name: string }
  | { type: 'dataset/setStatus'; id: string; status: DatasetStatus }
  | { type: 'dataset/delete'; id: string }
  | { type: 'project/add'; project: NewProject }
  | { type: 'project/duplicate'; id: string }
  | { type: 'project/setStatus'; id: string; status: ProjectStatus }
  | { type: 'project/delete'; id: string }
  | { type: 'project/recordRun'; id: string; runs: number; confidence: number }
  | { type: 'scenario/add'; scenario: NewScenario }
  | { type: 'scenario/update'; id: string; changes: Partial<Scenario> }
  | { type: 'scenario/duplicate'; id: string }
  | { type: 'scenario/delete'; id: string }
  | { type: 'notification/read'; id: string }
  | { type: 'notification/readAll' }
  | { type: 'team/invite'; name: string; jobTitle: string; role: WorkspaceRole }
  | { type: 'team/setRole'; id: string; role: WorkspaceRole }
  | { type: 'team/remove'; id: string }
  | { type: 'session/revoke'; id: string }
  | { type: 'settings/update'; changes: Partial<WorkspaceSettings> }
  | { type: 'settings/toggleNotification'; key: string }
  | { type: 'settings/revealApiKey'; reveal: boolean }
  | { type: 'settings/connectFeed'; connected: boolean }
  | { type: 'settings/setPlan'; plan: string }
  | { type: 'profile/update'; changes: Partial<ProfileDetails> }
  | { type: 'profile/syncIdentity'; identity: Partial<ProfileDetails> }
| { type: 'security/setTwoFactor'; enabled: boolean }
  | { type: 'toast/push'; toast: Omit<Toast, 'id'> }
  | { type: 'toast/dismiss'; id: string }
  /**
   * Applies one snapshot from Firestore. Carries only the slices that have arrived, because the
   * collections are separate subscriptions and report independently. Deliberately does not clear
   * `hydrated` — that is `workspace/ready`'s job, so the dashboard stays behind the skeleton until
   * the whole first round of snapshots has landed.
   */
  | { type: 'workspace/hydrate'; payload: WorkspaceHydration }
  /** Marks the store usable without touching data — used when there is no database to read from. */
  | { type: 'workspace/ready' }
  /** Puts slices back after a rejected write. Never touches toasts, seq or the sync flags. */
  | { type: 'workspace/restore'; patch: Partial<WorkspaceState> }
  | { type: 'workspace/syncError'; message: string | null };

export const initialWorkspaceState: WorkspaceState = {
  datasets: seedDatasets,
  projects: seedProjects,
  scenarios: seedScenarios,
  activity: seedActivity,
  notifications: seedNotifications,
  team: seedTeam,
  sessions: seedSessions,
  settings: seedSettings,
  profile: seedProfile,
  security: seedSecurity,
  toasts: [],
  seq: 0,
  toastSeq: 0,
  hydrated: false,
  syncError: null,
};

/**
 * Baseline for a real account with nothing in Firestore yet.
 *
 * A brand-new sign-up must land on an empty dashboard, not on the demo workspace. The fixtures in
 * `@/data/mock` are therefore *not* the defaults for a live user: every collection is empty and the
 * single-document state is neutral, with the workspace named after the account so the first screen
 * is not blank chrome.
 */
export function createFreshWorkspace(account: { displayName?: string | null; email?: string | null }): WorkspaceState {
  const label = account.displayName?.trim() || account.email?.split('@')[0]?.trim() || '';
  return {
    ...initialWorkspaceState,
    datasets: [],
    projects: [],
    scenarios: [],
    activity: [],
    notifications: [],
    team: [],
    sessions: [],
    settings: {
      name: label ? `${label}'s workspace` : 'My workspace',
      timezone: seedSettings.timezone,
      currency: seedSettings.currency,
      notifications: { ...seedSettings.notifications },
      revealApiKey: false,
      marketFeedConnected: false,
      plan: seedSettings.plan,
    },
    profile: { ...seedProfile, fullName: account.displayName?.trim() || '', email: account.email || '', initials: '', photoURL: null },
    security: { twoFactorEnabled: false },
    hydrated: false,
    syncError: null,
  };
}

type ActivityKind = ActivityEntry['type'];

/** Maximum number of toasts kept on screen at once. */
export const MAX_TOASTS = 4;

function log(state: WorkspaceState, type: ActivityKind, title: string, detail: string, status: Status, ref: string): ActivityEntry[] {
  const seq = state.seq + 1;
  // Keep the caller's entity id in the reference so History's copy/export actions show
  // something meaningful, and append the sequence to keep references unique.
  const stamp = seq.toString(16).toUpperCase().padStart(4, '0');
  return [{ id: `a${seq}`, title, detail, type, time: 'Just now', status, ref: `${ref.toUpperCase()}-${stamp}` }, ...state.activity].slice(0, 60);
}

function countRows(rows: string): number {
  const digits = rows.replace(/[^0-9]/g, '');
  return digits ? Number(digits) : 0;
}

export function workspaceReducer(state: WorkspaceState, action: WorkspaceAction): WorkspaceState {
  switch (action.type) {
    case 'dataset/add': {
      const seq = state.seq + 1;
      const dataset: Dataset = {
        ...action.dataset, id: `d${seq}-${Date.now().toString(36)}`, updated: 'Just now',
      };
      return {
        ...state,
        seq,
        datasets: [dataset, ...state.datasets],
        activity: log(state, 'dataset', dataset.name, 'Dataset uploaded', 'Completed', dataset.id),
        notifications: [{ id: `n${seq}`, title: 'Dataset added', text: `${dataset.name} is ready to forecast on.`, time: 'Just now', to: '/datasets', read: false }, ...state.notifications],
      };
    }
    case 'dataset/rename':
      return {
        ...state,
        datasets: state.datasets.map((d) => (d.id === action.id ? { ...d, name: action.name, updated: 'Just now' } : d)),
        activity: log(state, 'dataset', action.name, 'Dataset renamed', 'Completed', action.id),
      };
    case 'dataset/setStatus':
      return {
        ...state,
        datasets: state.datasets.map((d) => (d.id === action.id ? { ...d, status: action.status, updated: 'Just now' } : d)),
        activity: log(state, 'dataset', state.datasets.find((d) => d.id === action.id)?.name ?? 'Dataset', `Status set to ${action.status}`, action.status === 'Validated' ? 'Completed' : 'Needs review', action.id),
      };
    case 'dataset/delete': {
      const target = state.datasets.find((d) => d.id === action.id);
      return {
        ...state,
        datasets: state.datasets.filter((d) => d.id !== action.id),
        activity: log(state, 'dataset', target?.name ?? 'Dataset', 'Dataset deleted', 'Completed', action.id),
      };
    }

    case 'project/add': {
      const seq = state.seq + 1;
      const project: Project = {
        ...action.project, id: `p${seq}-${Date.now().toString(36)}`, lastRun: 'Never', status: 'Active',
      };
      return {
        ...state,
        seq,
        projects: [project, ...state.projects],
        activity: log(state, 'forecast', project.name, 'Forecast project created', 'Completed', project.id),
      };
    }
    case 'project/duplicate': {
      const source = state.projects.find((p) => p.id === action.id);
      if (!source) return state;
      const seq = state.seq + 1;
      const copy: Project = { ...source, id: `p${seq}-${Date.now().toString(36)}`, name: `${source.name} (copy)`, status: 'Draft', lastRun: 'Never', runs: 0 };
      return {
        ...state,
        seq,
        projects: [copy, ...state.projects],
        activity: log(state, 'forecast', copy.name, 'Project duplicated', 'Completed', copy.id),
      };
    }
    case 'project/setStatus': {
      const target = state.projects.find((p) => p.id === action.id);
      return {
        ...state,
        projects: state.projects.map((p) => (p.id === action.id ? { ...p, status: action.status, lastRun: action.status === 'Active' ? 'Just now' : p.lastRun } : p)),
        activity: log(state, 'forecast', target?.name ?? 'Project', `Status set to ${action.status}`, 'Completed', action.id),
      };
    }
    case 'project/delete': {
      const target = state.projects.find((p) => p.id === action.id);
      return {
        ...state,
        projects: state.projects.filter((p) => p.id !== action.id),
        activity: log(state, 'forecast', target?.name ?? 'Project', 'Project deleted', 'Completed', action.id),
      };
    }
    case 'project/recordRun': {
      const target = state.projects.find((p) => p.id === action.id);
      return {
        ...state,
        projects: state.projects.map((p) => (p.id === action.id ? { ...p, runs: action.runs, confidence: action.confidence, lastRun: 'Just now', status: 'Active' } : p)),
        activity: log(state, 'forecast', target?.name ?? 'Project', 'Forecast run completed', 'Completed', action.id),
        notifications: [{ id: `nr-${action.id}-${state.seq + 1}`, title: 'Forecast completed', text: `${target?.name ?? 'Your project'} is ready to review.`, time: 'Just now', to: '/projects', read: false }, ...state.notifications],
      };
    }

    case 'scenario/add': {
      const seq = state.seq + 1;
      const scenario: Scenario = { ...action.scenario, id: `s${seq}-${Date.now().toString(36)}` };
      return {
        ...state,
        seq,
        scenarios: [scenario, ...state.scenarios],
        activity: log(state, 'scenario', scenario.name, 'Scenario created', 'Completed', scenario.id),
      };
    }
    case 'scenario/update': {
      const target = state.scenarios.find((s) => s.id === action.id);
      return {
        ...state,
        scenarios: state.scenarios.map((s) => (s.id === action.id ? { ...s, ...action.changes } : s)),
        activity: log(state, 'scenario', target?.name ?? 'Scenario', 'Scenario updated', 'Completed', action.id),
      };
    }
    case 'scenario/duplicate': {
      const source = state.scenarios.find((s) => s.id === action.id);
      if (!source) return state;
      const seq = state.seq + 1;
      const copy: Scenario = { ...source, id: `s${seq}-${Date.now().toString(36)}`, name: `${source.name} (copy)` };
      return {
        ...state,
        seq,
        scenarios: [copy, ...state.scenarios],
        activity: log(state, 'scenario', copy.name, 'Scenario duplicated', 'Completed', copy.id),
      };
    }
    case 'scenario/delete': {
      const target = state.scenarios.find((s) => s.id === action.id);
      return {
        ...state,
        scenarios: state.scenarios.filter((s) => s.id !== action.id),
        activity: log(state, 'scenario', target?.name ?? 'Scenario', 'Scenario deleted', 'Completed', action.id),
      };
    }

    case 'notification/read':
      return { ...state, notifications: state.notifications.map((n) => (n.id === action.id ? { ...n, read: true } : n)) };
    case 'notification/readAll':
      return { ...state, notifications: state.notifications.map((n) => ({ ...n, read: true })) };

    case 'team/invite': {
      const seq = state.seq + 1;
      const member: TeamMember = { id: `u${seq}`, name: action.name, jobTitle: action.jobTitle, role: action.role, invited: true };
      return { ...state, seq, team: [...state.team, member], activity: log(state, 'team', action.name, 'Invitation sent', 'Completed', member.id) };
    }
    case 'team/setRole': {
      const target = state.team.find((m) => m.id === action.id);
      return {
        ...state,
        team: state.team.map((m) => (m.id === action.id ? { ...m, role: action.role } : m)),
        activity: log(state, 'team', target?.name ?? 'Member', `Role changed to ${action.role}`, 'Completed', action.id),
      };
    }
    case 'team/remove': {
      const target = state.team.find((m) => m.id === action.id);
      return {
        ...state,
        team: state.team.filter((m) => m.id !== action.id),
        activity: log(state, 'team', target?.name ?? 'Member', 'Removed from workspace', 'Completed', action.id),
      };
    }

    case 'session/revoke': {
      const target = state.sessions.find((s) => s.id === action.id);
      return {
        ...state,
        sessions: state.sessions.filter((s) => s.id !== action.id),
        activity: log(state, 'security', target?.device ?? 'Session', 'Session signed out', 'Completed', action.id),
      };
    }

    case 'settings/update':
      return { ...state, settings: { ...state.settings, ...action.changes } };
    case 'settings/toggleNotification':
      return {
        ...state,
        settings: { ...state.settings, notifications: { ...state.settings.notifications, [action.key]: !state.settings.notifications[action.key] } },
      };
    case 'settings/revealApiKey':
      return { ...state, settings: { ...state.settings, revealApiKey: action.reveal } };
    case 'settings/connectFeed':
      return {
        ...state,
        settings: { ...state.settings, marketFeedConnected: action.connected },
        activity: log(state, 'dataset', 'External market data feed', action.connected ? 'Integration connected' : 'Integration disconnected', 'Completed', 'feed'),
      };
    case 'settings/setPlan':
      return {
        ...state,
        settings: { ...state.settings, plan: action.plan },
        activity: log(state, 'team', `${action.plan} plan`, 'Subscription plan changed', 'Completed', 'plan'),
      };

    case 'profile/update':
      return {
        ...state,
        profile: { ...state.profile, ...action.changes },
        activity: log(state, 'team', action.changes.fullName ?? state.profile.fullName, 'Profile updated', 'Completed', 'profile'),
      };

    // Mirrors the signed-in Firebase identity into the store so the header, sidebar and team
    // views agree on who is signed in. Deliberately writes no activity entry: signing in is
    // not an edit the workspace should see in its audit trail.
    case 'profile/syncIdentity':
      return {
        ...state,
        profile: { ...state.profile, ...action.identity },
      };

    case 'security/setTwoFactor':
      return {
        ...state,
        security: { ...state.security, twoFactorEnabled: action.enabled },
        activity: log(state, 'security', 'Authenticator app', action.enabled ? 'Two-factor authentication enabled' : 'Two-factor authentication disabled', 'Completed', '2fa'),
      };

case 'toast/push':
      return {
        ...state,
        // The id comes from a counter rather than the stack length, so trimming the stack
        // to MAX_TOASTS can never produce a duplicate id.
        toastSeq: state.toastSeq + 1,
        toasts: [...state.toasts, { ...action.toast, id: `t${state.toastSeq + 1}` }].slice(-MAX_TOASTS),
      };
    case 'toast/dismiss':
      return { ...state, toasts: state.toasts.filter((t) => t.id !== action.id) };

    // A snapshot is authoritative for the slices it carries. `mergeHydration` layers it over the
    // current state rather than replacing it, so a document that only stores some of the fields
    // (which any hand-edited collection will) cannot blank out a working screen.
    case 'workspace/hydrate':
      return { ...state, ...mergeHydration(state, action.payload) };

    case 'workspace/ready':
      return state.hydrated ? state : { ...state, hydrated: true };

    case 'workspace/restore':
      return { ...state, ...action.patch };

    case 'workspace/syncError':
      return { ...state, syncError: action.message };

    default:
      return state;
  }
}

export function unreadCount(notifications: NotificationItem[]): number {
  return notifications.filter((n) => !n.read).length;
}

export function adminCount(state: WorkspaceState): number {
  return state.team.filter((m) => m.role === 'Admin').length;
}

export function totalRuns(projects: Project[]): number {
  return projects.reduce((sum, p) => sum + p.runs, 0);
}

export function meanAccuracy(state: WorkspaceState): number {
  const live = state.projects.filter((p) => p.status !== 'Draft');
  if (live.length === 0) return 0;
  return live.reduce((sum, p) => sum + p.confidence, 0) / live.length;
}

export function datasetRowTotal(state: WorkspaceState): number {
  return state.datasets.reduce((sum, d) => sum + countRows(d.rows), 0);
}

export function projectStatusCounts(state: WorkspaceState): Array<{ name: ProjectStatus; value: number }> {
  return (['Active', 'Completed', 'Draft', 'Archived'] as ProjectStatus[]).map((status) => ({
    name: status,
    value: state.projects.filter((p) => p.status === status).length,
  }));
}

export type DatasetFilterState = { status: DatasetStatus | 'all'; source: string | 'all' };
export type ProjectFilterState = { status: ProjectStatus | 'all'; datasetId: string | 'all' };
export type ScenarioFilterState = { objective: string | 'all'; project: string | 'all' };
export type ActivityFilterState = { type: ActivityEntry['type'] | 'all'; status: Status | 'all' };
