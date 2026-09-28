import { Toggle } from '@/components/ui/Toggle';
import { useWorkspace, useWorkspaceDispatch } from '@/state/workspaceContext';

const LABELS = [
  'Email me when a forecast run completes',
  'Notify on dataset validation errors',
  'Weekly workspace summary',
  'Scenario comparison ready',
] as const;

export function NotificationsTab() {
  const { settings, profile } = useWorkspace();
  const dispatch = useWorkspaceDispatch();

  return (
    <div className="toggle-list">
      {LABELS.map((label) => {
        const enabled = settings.notifications[label];
        return (
          <div className="toggle-row" key={label}>
            <span>
              <b>{label}</b>
              <small>Receive updates at {profile.email}</small>
            </span>
            <Toggle
              checked={enabled}
              label={label}
              onChange={() => {
                dispatch({ type: 'settings/toggleNotification', key: label });
                dispatch({
                  type: 'toast/push',
                  toast: { kind: 'info', title: enabled ? 'Notification off' : 'Notification on', message: label },
                });
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
