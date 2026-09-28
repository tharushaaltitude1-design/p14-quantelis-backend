import { useState } from 'react';
import { CURRENCIES, TIMEZONES } from '@/data/mock';
import { Select } from '@/components/ui/Select';
import { useWorkspace, useWorkspaceDispatch } from '@/state/workspaceContext';

export function GeneralTab() {
  const { settings, profile } = useWorkspace();
  const dispatch = useWorkspaceDispatch();
  const [name, setName] = useState(settings.name);
  const [timezone, setTimezone] = useState(settings.timezone);
  const [currency, setCurrency] = useState(settings.currency);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const dirty = name !== settings.name || timezone !== settings.timezone || currency !== settings.currency;

  const save = () => {
    if (name.trim().length < 2) {
      setError('Workspace name must be at least 2 characters.');
      return;
    }
    setError('');
    setSaving(true);
    window.setTimeout(() => {
      dispatch({ type: 'settings/update', changes: { name: name.trim(), timezone, currency } });
      setSaving(false);
      dispatch({ type: 'toast/push', toast: { kind: 'success', title: 'Settings saved', message: `Workspace preferences updated for ${profile.email}.` } });
    }, 700);
  };

  return (
    <div className="settings-form">
      <label className="field-label" htmlFor="ws-name">
        Workspace name
      </label>
      <input
        id="ws-name"
        className="text-input"
        value={name}
        onChange={(event) => {
          setName(event.target.value);
          setError('');
        }}
        aria-invalid={error ? true : undefined}
      />
      <label className="field-label" htmlFor="ws-timezone">
        Timezone
      </label>
      <Select id="ws-timezone" value={timezone} onChange={setTimezone} options={TIMEZONES} label="Timezone" className="settings-select" />
      <label className="field-label" htmlFor="ws-currency">
        Default currency
      </label>
      <Select id="ws-currency" value={currency} onChange={setCurrency} options={CURRENCIES} label="Default currency" className="settings-select" />
      {error && (
        <span className="field-error" role="alert">
          {error}
        </span>
      )}
      <div className="modal-actions">
        <button type="button" className="primary-button" onClick={save} disabled={!dirty || saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  );
}
