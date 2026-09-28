import { useState } from 'react';
import { Check, ChevronRight, Download } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { StatusPill } from '@/components/ui/StatusPill';
import { PLANS, USAGE_BREAKDOWN, INVOICES, type PlanName } from './settingsData';
import { downloadCsv } from '@/lib/csv';
import { useWorkspace, useWorkspaceDispatch } from '@/state/workspaceContext';

export function BillingTab() {
  const { settings, team } = useWorkspace();
  const dispatch = useWorkspaceDispatch();
  const [switching, setSwitching] = useState<PlanName | null>(null);
  const [managing, setManaging] = useState(false);
  const [invoice, setInvoice] = useState<string | null>(null);

  return (
    <div className="billing-grid">
      <div className="plan-current">
        <span className="eyebrow">CURRENT PLAN</span>
        <h3>{settings.plan} plan</h3>
        <p>
          {team.length} of 5 seats used · renews Nov 1, 2025
        </p>
        <div className="usage-list">
          {USAGE_BREAKDOWN.map((item) => {
            const pct = Math.min(100, Math.round((item.used / item.limit) * 100));
            return (
              <div className="usage-line" key={item.label}>
                <span>
                  {item.label} <b>{pct}%</b>
                </span>
                <i>
                  <em style={{ width: `${pct}%` }} />
                </i>
                <small>
                  {item.used.toLocaleString()} of {item.limit.toLocaleString()} {item.unit}
                </small>
              </div>
            );
          })}
        </div>
        <button type="button" className="primary-button" onClick={() => setManaging(true)}>
          Manage plan
        </button>
      </div>

      {PLANS.map((plan) => {
        const current = plan.name === settings.plan;
        return (
          <div className={`plan-card ${current ? 'featured' : ''}`} key={plan.name}>
            <b>{plan.name}</b>
            <span>{plan.blurb}</span>
            <small className="plan-price">{plan.price}</small>
            <button
              type="button"
              className="link-button"
              onClick={() => (current ? setManaging(true) : setSwitching(plan.name))}
              aria-disabled={current}
            >
              {current ? 'Current plan' : 'Switch to this plan'} <ChevronRight size={14} />
            </button>
          </div>
        );
      })}

      <div className="invoice-list">
        <h3 className="section-label">Recent invoices</h3>
        {INVOICES.map((row) => (
          <div className="invoice-row" key={row.id}>
            <span>
              <b>{row.id}</b>
              <small>{row.date}</small>
            </span>
            <span>{row.amount}</span>
            <StatusPill status={row.status} />
            <button
              type="button"
              className="icon-button"
              aria-label={`Download ${row.id}`}
              onClick={() => {
                setInvoice(row.id);
              }}
            >
              <Download size={16} />
            </button>
          </div>
        ))}
      </div>

      {switching && (
        <ConfirmDialog
          title={`Switch to the ${switching} plan?`}
          message="Your workspace moves to the new plan immediately. Any unused credit from the current plan is applied to this invoice."
          confirmLabel={`Switch to ${switching}`}
          onCancel={() => setSwitching(null)}
          onConfirm={() => {
            dispatch({ type: 'settings/setPlan', plan: switching });
            dispatch({ type: 'toast/push', toast: { kind: 'success', title: 'Plan updated', message: `Your workspace is now on the ${switching} plan.` } });
            setSwitching(null);
          }}
        />
      )}

      {managing && (
        <Modal title="Manage your subscription" onClose={() => setManaging(false)}>
          <div className="wizard-content">
            <p>
              You are on the <b>{settings.plan}</b> plan. Plan changes, seat additions, and cancellations are all available from this dialog in
              this build.
            </p>
            <div className="usage-list">
              {USAGE_BREAKDOWN.map((item) => (
                <div className="usage-line" key={item.label}>
                  <span>
                    {item.label} <b>{item.used.toLocaleString()}</b>
                  </span>
                  <small>of {item.limit.toLocaleString()} {item.unit}</small>
                </div>
              ))}
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={() => setManaging(false)}>
              Close
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={() => {
                downloadCsv('quantelis-invoices.csv', ['Invoice', 'Date', 'Amount', 'Status'], INVOICES.map((i) => [i.id, i.date, i.amount, i.status]));
                dispatch({ type: 'toast/push', toast: { kind: 'success', title: 'Invoices exported', message: `${INVOICES.length} invoices written to CSV.` } });
              }}
            >
              <Check size={16} /> Export invoices
            </button>
          </div>
        </Modal>
      )}

      {invoice && (
        <Modal title={`Invoice ${invoice}`} onClose={() => setInvoice(null)}>
          <div className="wizard-content">
            <div className="detail-stats">
              <div>
                <span>Amount</span>
                <b>{INVOICES.find((i) => i.id === invoice)?.amount}</b>
              </div>
              <div>
                <span>Status</span>
                <b>{INVOICES.find((i) => i.id === invoice)?.status}</b>
              </div>
              <div>
                <span>Date</span>
                <b>{INVOICES.find((i) => i.id === invoice)?.date}</b>
              </div>
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={() => setInvoice(null)}>
              Close
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={() => {
                downloadCsv(`${invoice}.csv`, ['Invoice', 'Date', 'Amount', 'Status'], [[invoice, ...[INVOICES.find((i) => i.id === invoice)?.date ?? '', INVOICES.find((i) => i.id === invoice)?.amount ?? '', INVOICES.find((i) => i.id === invoice)?.status ?? '']]]);
                dispatch({ type: 'toast/push', toast: { kind: 'success', title: 'Invoice downloaded', message: `${invoice} saved as CSV.` } });
                setInvoice(null);
              }}
            >
              <Download size={16} /> Download CSV
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
