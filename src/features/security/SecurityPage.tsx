import { useState } from 'react';
import { Activity, ShieldCheck } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Toggle } from '@/components/ui/Toggle';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useWorkspace, useWorkspaceDispatch } from '@/state/workspaceContext';
import type { Session } from '@/data/mock';

const scoreStrength = (value: string) => {
  let score = 0;
  if (value.length >= 12) score += 1;
  if (value.length >= 16) score += 1;
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score += 1;
  if (/\d/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value)) score += 1;
  return score;
};

const LABELS = ['Too short', 'Weak', 'Fair', 'Good', 'Strong', 'Excellent'];

export function SecurityPage() {
  const { security, sessions, profile } = useWorkspace();
  const dispatch = useWorkspaceDispatch();

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [lastUpdated, setLastUpdated] = useState('42 days ago');
  const [revoking, setRevoking] = useState<Session | null>(null);

  const strength = scoreStrength(next);

  const submit = () => {
    const found: Record<string, string> = {};
    if (current.length < 1) found.current = 'Enter your current password.';
    if (next.length < 12) found.next = 'New password must be at least 12 characters.';
    else if (strength < 3) found.next = 'Mix upper and lower case, numbers, and symbols.';
    if (next !== confirm) found.confirm = 'Passwords do not match.';
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    window.setTimeout(() => {
      setSaving(false);
      setCurrent('');
      setNext('');
      setConfirm('');
      setLastUpdated('just now');
      dispatch({ type: 'toast/push', toast: { kind: 'success', title: 'Password updated', message: 'Use your new password the next time you sign in.' } });
    }, 800);
  };

  return (
    <div className="page-stack security-grid">
      <Card>
        <CardHeader title="Change password" meta={`Last updated ${lastUpdated}`} />
        <div className="settings-form">
          <label className="field-label" htmlFor="pw-current">
            Current password
          </label>
          <input
            id="pw-current"
            type="password"
            className="text-input"
            value={current}
            placeholder="••••••••••••"
            autoComplete="current-password"
            aria-invalid={errors.current ? true : undefined}
            onChange={(event) => {
              setCurrent(event.target.value);
              setErrors((e) => ({ ...e, current: '' }));
            }}
          />
          {errors.current && (
            <span className="field-error" role="alert">
              {errors.current}
            </span>
          )}
          <label className="field-label" htmlFor="pw-new">
            New password
          </label>
          <input
            id="pw-new"
            type="password"
            className="text-input"
            value={next}
            placeholder="At least 12 characters"
            autoComplete="new-password"
            aria-invalid={errors.next ? true : undefined}
            onChange={(event) => {
              setNext(event.target.value);
              setErrors((e) => ({ ...e, next: '' }));
            }}
          />
          {next.length > 0 && (
            <div className="strength-meter">
              <i>
                <em style={{ width: `${(strength / 5) * 100}%` }} data-level={strength} />
              </i>
              <span data-level={strength}>{LABELS[strength]}</span>
            </div>
          )}
          {errors.next && (
            <span className="field-error" role="alert">
              {errors.next}
            </span>
          )}
          <label className="field-label" htmlFor="pw-confirm">
            Confirm new password
          </label>
          <input
            id="pw-confirm"
            type="password"
            className="text-input"
            value={confirm}
            placeholder="Repeat your new password"
            autoComplete="new-password"
            aria-invalid={errors.confirm ? true : undefined}
            onChange={(event) => {
              setConfirm(event.target.value);
              setErrors((e) => ({ ...e, confirm: '' }));
            }}
          />
          {errors.confirm && (
            <span className="field-error" role="alert">
              {errors.confirm}
            </span>
          )}
          <div className="modal-actions">
            <button type="button" className="primary-button" onClick={submit} disabled={saving || (current === '' && next === '' && confirm === '')}>
              {saving ? 'Updating…' : 'Update password'}
            </button>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Two-factor authentication" meta="Recommended for all workspace admins" />
        <div className="security-toggle">
          <div className="security-icon">
            <ShieldCheck size={19} />
          </div>
          <span>
            <b>Authenticator app</b>
            <small>{security.twoFactorEnabled ? `Enabled for ${profile.email}.` : 'Add an extra layer of protection to your account.'}</small>
          </span>
          <Toggle
            checked={security.twoFactorEnabled}
            label="Authenticator app two-factor authentication"
            onChange={(nextState) => {
              dispatch({ type: 'security/setTwoFactor', enabled: nextState });
              dispatch({
                type: 'toast/push',
                toast: {
                  kind: nextState ? 'success' : 'info',
                  title: nextState ? 'Two-factor enabled' : 'Two-factor disabled',
                  message: nextState ? 'Scan the setup code in your authenticator app to finish.' : 'Your account now relies on a password alone.',
                },
              });
            }}
          />
        </div>
        {security.twoFactorEnabled && (
          <p className="compare-note" role="status">
            Two-factor authentication is active. Keep your recovery codes somewhere safe.
          </p>
        )}
      </Card>

      <Card className="sessions-card">
        <CardHeader title="Active sessions" meta={`${sessions.length} device${sessions.length === 1 ? '' : 's'} signed in`} />
        {sessions.map((session) => (
          <div className="session-row" key={session.id}>
            <span className="device-icon">
              <Activity size={17} />
            </span>
            <span>
              <b>{session.device}</b>
              <small>
                {session.location} · {session.lastActive}
              </small>
            </span>
            {session.current ? (
              <span className="current-device">Current</span>
            ) : (
              <button type="button" className="text-button danger-text" onClick={() => setRevoking(session)}>
                Sign out
              </button>
            )}
          </div>
        ))}
        {sessions.length <= 1 && (
          <p className="compare-note">Only this device is signed in.</p>
        )}
      </Card>

      {revoking && (
        <ConfirmDialog
          title="Sign out this device?"
          message={`${revoking.device} in ${revoking.location} will need to sign in again.`}
          confirmLabel="Sign out device"
          onCancel={() => setRevoking(null)}
          onConfirm={() => {
            dispatch({ type: 'session/revoke', id: revoking.id });
            dispatch({ type: 'toast/push', toast: { kind: 'success', title: 'Device signed out', message: `${revoking.device} was removed.` } });
            setRevoking(null);
          }}
        />
      )}
    </div>
  );
}
