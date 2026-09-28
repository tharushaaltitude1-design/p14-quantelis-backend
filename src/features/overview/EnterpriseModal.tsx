import { Check } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { useWorkspaceDispatch } from '@/state/workspaceContext';

const PERKS = [
  'Unlimited forecasting projects and scenario comparisons',
  'Shared team workspaces with role-based access control',
  'Priority compute for large datasets and long horizons',
  'Scheduled runs, alerting and audit history retention',
];

/**
 * The callout has no external destination to link to, and inventing a pricing URL is not
 * allowed, so the CTA opens a real, informative dialog instead of a dead button.
 */
export function EnterpriseModal({ onClose }: { onClose: () => void }) {
  const dispatch = useWorkspaceDispatch();
  return (
    <Modal title="Quantelis Enterprise" onClose={onClose}>
      <p className="modal-intro">Everything in Team, plus the capabilities larger planning functions rely on.</p>
      <ul className="perk-list">
        {PERKS.map((perk) => (
          <li key={perk}>
            <Check size={15} />
            <span>{perk}</span>
          </li>
        ))}
      </ul>
      <p className="form-note">This build has no billing backend, so nothing is charged or upgraded.</p>
      <div className="modal-actions">
        <button type="button" className="secondary-button" onClick={onClose}>
          Not now
        </button>
        <button
          type="button"
          className="primary-button"
          onClick={() => {
            onClose();
            dispatch({ type: 'toast/push', toast: { kind: 'info', title: 'Request recorded', message: 'A Quantelis specialist would follow up — no request was actually sent in this build.' } });
          }}
        >
          Talk to sales
        </button>
      </div>
    </Modal>
  );
}
