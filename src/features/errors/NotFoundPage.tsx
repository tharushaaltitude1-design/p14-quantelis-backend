import { Compass } from 'lucide-react';
import { Link } from 'react-router-dom';
import { EmptyState } from '@/components/ui/EmptyState';

export function NotFoundPage() {
  return (
    <div className="page-stack">
      <div className="card">
        <EmptyState icon={<Compass size={28} />} title="Page not found" text="The page you are looking for does not exist or has moved." />
        <div className="modal-actions"><Link className="primary-button" to="/">Back to overview</Link></div>
      </div>
    </div>
  );
}
