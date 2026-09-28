import type { ReactNode } from 'react';

type EmptyStateProps = { icon: ReactNode; title: string; text: string; actionLabel?: string; onAction?: () => void };

export function EmptyState({ icon, title, text, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="empty-state">
      {icon}<b>{title}</b><span>{text}</span>
      {actionLabel && onAction && <button className="secondary-button" onClick={onAction}>{actionLabel}</button>}
    </div>
  );
}
