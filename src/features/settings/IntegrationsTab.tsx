import { useState } from 'react';
import { Copy, Eye, EyeOff, Plug, Unplug, Zap } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { API_KEY_MASKED, API_KEY_PLAIN } from './settingsData';
import { useWorkspace, useWorkspaceDispatch } from '@/state/workspaceContext';

export function IntegrationsTab() {
  const { settings } = useWorkspace();
  const dispatch = useWorkspaceDispatch();
  const [reveal, setReveal] = useState(settings.revealApiKey);
  const [disconnecting, setDisconnecting] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyKey = async () => {
    try {
      await navigator.clipboard.writeText(API_KEY_PLAIN);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
      dispatch({ type: 'toast/push', toast: { kind: 'success', title: 'API key copied', message: 'Store it somewhere safe — it will not be shown again.' } });
    } catch {
      dispatch({ type: 'toast/push', toast: { kind: 'danger', title: 'Copy failed', message: 'Your browser blocked clipboard access.' } });
    }
  };

  return (
    <div className="settings-form">
      <span className="field-label">Workspace API key</span>
      <div className="input-with-action">
        <input className="text-input" value={reveal ? API_KEY_PLAIN : API_KEY_MASKED} readOnly aria-label="Workspace API key" />
        <button
          type="button"
          className="text-button"
          onClick={() => {
            setReveal(!reveal);
            dispatch({ type: 'settings/revealApiKey', reveal: !reveal });
          }}
        >
          {reveal ? <EyeOff size={14} /> : <Eye size={14} />} {reveal ? 'Hide' : 'Reveal'}
        </button>
        <button type="button" className="text-button" onClick={copyKey} disabled={!reveal} title={reveal ? 'Copy key' : 'Reveal the key first'}>
          <Copy size={14} /> {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <p className="compare-note">Reveal the key to copy it. Treat it like a password and rotate it if it leaks.</p>

      <div className="integration-row">
        <span className="integration-icon">
          <Zap size={17} />
        </span>
        <span>
          <b>External market data feed</b>
          <small>Connect pricing and macroeconomic signals.</small>
        </span>
        {settings.marketFeedConnected ? (
          <button type="button" className="secondary-button" onClick={() => setDisconnecting(true)}>
            <Unplug size={15} /> Disconnect
          </button>
        ) : (
          <button
            type="button"
            className="secondary-button"
            disabled={connecting}
            onClick={() => {
              setConnecting(true);
              window.setTimeout(() => {
                dispatch({ type: 'settings/connectFeed', connected: true });
                dispatch({ type: 'toast/push', toast: { kind: 'success', title: 'Feed connected', message: 'Market data will enrich your next forecast run.' } });
                setConnecting(false);
              }, 800);
            }}
          >
            <Plug size={15} /> {connecting ? 'Connecting…' : 'Connect'}
          </button>
        )}
      </div>
      {settings.marketFeedConnected && (
        <p className="compare-note" role="status">
          Connected. Macroeconomic signals are being applied to new forecast runs.
        </p>
      )}

      {disconnecting && (
        <ConfirmDialog
          title="Disconnect the market data feed?"
          message="New forecast runs will stop using external market signals. Your existing results are unchanged."
          confirmLabel="Disconnect feed"
          onCancel={() => setDisconnecting(false)}
          onConfirm={() => {
            dispatch({ type: 'settings/connectFeed', connected: false });
            dispatch({ type: 'toast/push', toast: { kind: 'info', title: 'Feed disconnected', message: 'Market data is no longer applied to new runs.' } });
            setDisconnecting(false);
          }}
        />
      )}
    </div>
  );
}
