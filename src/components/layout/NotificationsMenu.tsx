import { useCallback, useRef, useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { Popover } from '@/components/ui/Popover';
import { useWorkspace, useWorkspaceDispatch } from '@/state/workspaceContext';
import { unreadCount } from '@/state/workspaceReducer';

export function NotificationsMenu({ onNavigate }: { onNavigate: (to: string) => void }) {
  const { notifications } = useWorkspace();
  const dispatch = useWorkspaceDispatch();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const unread = unreadCount(notifications);
  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="icon-button notification-button"
        onClick={() => setOpen((value) => !value)}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Bell size={18} />
        {unread > 0 && <span aria-hidden="true" />}
      </button>
      <Popover open={open} onClose={close} anchorRef={triggerRef} label="Notifications" role="dialog" className="notifications-panel">
        {() => (
          <>
            <div className="panel-heading">
              <div>
                <b>Notifications</b>
                <span>{unread > 0 ? `${unread} unread update${unread === 1 ? '' : 's'}` : 'All caught up'}</span>
              </div>
              <button
                type="button"
                className="text-button"
                disabled={unread === 0}
                onClick={() => {
                  dispatch({ type: 'notification/readAll' });
                  dispatch({ type: 'toast/push', toast: { kind: 'success', title: 'All caught up', message: 'Every notification was marked as read.' } });
                }}
              >
                <CheckCheck size={14} aria-hidden="true" /> Mark all read
              </button>
            </div>
            {notifications.length === 0 ? (
              <p className="notifications-empty">You have no notifications.</p>
            ) : (
              notifications.map((item) => (
                <button
                  type="button"
                  className={`notification-row ${item.read ? 'is-read' : ''}`}
                  key={item.id}
                  onClick={() => {
                    dispatch({ type: 'notification/read', id: item.id });
                    close();
                    onNavigate(item.to);
                  }}
                >
                  <span className="notification-dot" aria-hidden="true" />
                  <span>
                    <b>{item.title}</b>
                    <small>{item.text}</small>
                    <em>{item.time}</em>
                  </span>
                  {item.read && <span className="visually-hidden">Read</span>}
                </button>
              ))
            )}
          </>
        )}
      </Popover>
    </>
  );
}
