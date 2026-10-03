import { useState } from 'react';
import { Database, HardDriveDownload, Trash2 } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { StatusPill } from '@/components/ui/StatusPill';
import { db, isFirestoreEnabled } from '@/lib/firestore';
import { demoSeedDocumentCount, demoSeedSummary } from '@/services/seedWorkspace';
import { toError } from '@/services/workspaceRepo';
import { useAuth } from '@/state/authContext';
import { useWorkspace, useWorkspaceDispatch, useWorkspaceReset, type WorkspaceMode } from '@/state/workspaceContext';

/**
 * Demo fixtures may only be written when the build explicitly opts in. Defaults to on in dev so a
 * fresh clone can be exercised, and off everywhere else, which is what stops demo records from
 * appearing in a production workspace.
 */
const demoEnabled = import.meta.env.DEV || import.meta.env.VITE_USE_MOCK_DATA === 'true';

/**
 * Workspace data controls.
 *
 * A new account is seeded automatically on first load (see `WorkspaceProvider`), so these buttons
 * are for starting over rather than for the first run: re-seeding with the current fixtures, or
 * emptying the account for good.
 *
 * Seeding runs as the signed-in user through the normal Firestore SDK, so it needs no service
 * account and no privileged credential. The demo-data section is gated behind
 * `VITE_USE_MOCK_DATA`: with the flag off, demo content cannot be injected into a live workspace
 * even by someone who finds the URL.
 */
export function DataTab() {
  const { datasets, projects, scenarios, activity, team } = useWorkspace();
  const dispatch = useWorkspaceDispatch();
  const resetWorkspace = useWorkspaceReset();
  const { user } = useAuth();

  const [busy, setBusy] = useState<WorkspaceMode | null>(null);
  const [error, setError] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);

  const uid = user?.uid ?? null;
  const connected = isFirestoreEnabled && db !== null && uid !== null;

  /** Runs a bulk Firestore operation and reports the outcome as a toast, never as a silent failure. */
  const run = async (mode: WorkspaceMode) => {
    setBusy(mode);
    setError('');
    try {
      await resetWorkspace(mode);
      dispatch({
        type: 'toast/push',
        toast:
          mode === 'seed'
            ? { kind: 'success', title: `Demo data loaded — ${demoSeedDocumentCount} documents` }
            : { kind: 'success', title: 'Workspace cleared' },
      });
    } catch (cause) {
      const message = toError(cause).message;
      setError(message);
      dispatch({
        type: 'toast/push',
        toast: { kind: 'danger', title: 'Firestore request failed', message },
      });
    } finally {
      setBusy(null);
      setConfirmClear(false);
    }
  };

  if (!isFirestoreEnabled) {
    return (
      <div className="settings-form">
        <p className="compare-note">
          No Firestore configuration found. Add the <code>VITE_FIREBASE_*</code> values to <code>.env</code> and restart the dev server.
        </p>
      </div>
    );
  }

  const stored = [
    { label: 'datasets', count: datasets.length },
    { label: 'projects', count: projects.length },
    { label: 'scenarios', count: scenarios.length },
    { label: 'activity entries', count: activity.length },
    { label: 'team members', count: team.length },
  ];

  return (
    <div className="settings-form">
      <span className="field-label">Storage</span>
      <div className="integration-row">
        <span className="integration-icon">
          <Database size={17} />
        </span>
        <span>
          <b>Cloud Firestore</b>
          <small>
            {connected
              ? `Everything on this screen lives under users/${uid} and is readable only by your account.`
              : 'Sign in to read or write workspace data.'}
          </small>
        </span>
        <StatusPill status={connected ? 'Connected' : 'Signed out'} />
      </div>

      <span className="field-label">Stored now</span>
      <CountList rows={stored} />

      {demoEnabled && (
        <>
          <span className="field-label">Demo data</span>
          <p className="compare-note">
            A new account is filled with the demo records automatically the first time it loads, so the screens can be
            exercised against real reads and writes. Reloading replaces everything below your account with these{' '}
            {demoSeedDocumentCount} documents.
          </p>
          <CountList rows={demoSeedSummary} />
          {error && (
            <span className="field-error" role="alert">
              {error}
            </span>
          )}
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={() => void run('seed')} disabled={!connected || busy !== null}>
              <HardDriveDownload size={15} /> {busy === 'seed' ? 'Seeding…' : 'Re-seed demo data'}
            </button>
            <button
              type="button"
              className="danger-button"
              onClick={() => setConfirmClear(true)}
              disabled={!connected || busy !== null}
            >
              <Trash2 size={15} /> Clear workspace
            </button>
          </div>
        </>
      )}

      {confirmClear && (
        <ConfirmDialog
          title="Clear this workspace?"
          message="Every dataset, project, scenario, activity entry, notification and teammate will be deleted, along with your saved settings and security state. The account stays, and stays empty until you re-seed. This cannot be undone."
          confirmLabel="Delete everything"
          onCancel={() => setConfirmClear(false)}
          onConfirm={() => void run('clear')}
        />
      )}
    </div>
  );
}

function CountList({ rows }: { rows: ReadonlyArray<{ label: string; count: number }> }) {
  return (
    <ul className="data-counts">
      {rows.map((row) => (
        <li key={row.label}>
          <span>{row.label}</span>
          <b>{row.count}</b>
        </li>
      ))}
    </ul>
  );
}