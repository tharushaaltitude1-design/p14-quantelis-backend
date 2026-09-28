import type { ReactNode } from 'react';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`card ${className}`}>{children}</div>;
}

type CardHeaderProps = { title: string; meta?: string; action?: ReactNode };

export function CardHeader({ title, meta, action }: CardHeaderProps) {
  return (
    <div className="card-header">
      <div><h2>{title}</h2>{meta && <span>{meta}</span>}</div>
      {action}
    </div>
  );
}
