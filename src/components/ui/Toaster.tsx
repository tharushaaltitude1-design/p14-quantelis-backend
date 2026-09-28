import { useEffect } from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { useWorkspace, useWorkspaceDispatch } from '@/state/workspaceContext';
import type { Toast } from '@/state/workspaceReducer';

const ICONS = { info: Info, success: CheckCircle2, danger: AlertTriangle } as const;

function ToastRow({ toast }: { toast: Toast }) {
  const dispatch = useWorkspaceDispatch();
  const Icon = ICONS[toast.kind];
  useEffect(() => {
    const timer = window.setTimeout(() => dispatch({ type: 'toast/dismiss', id: toast.id }), 4500);
    return () => window.clearTimeout(timer);
  }, [dispatch, toast.id]);
  return (
    <div className={`toast is-${toast.kind}`}>
      <span className="toast-icon">
        <Icon size={16} />
      </span>
      <span className="toast-copy">
        <b>{toast.title}</b>
        {toast.message && <span>{toast.message}</span>}
      </span>
      <button type="button" className="toast-dismiss" onClick={() => dispatch({ type: 'toast/dismiss', id: toast.id })} aria-label={`Dismiss: ${toast.title}`}>
        <X size={14} />
      </button>
    </div>
  );
}

/** Global feedback surface. Mounted once inside <WorkspaceProvider>. */
export function Toaster() {
  const { toasts } = useWorkspace();
  return (
    <div className="toaster" role="status" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => (
        <ToastRow key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
