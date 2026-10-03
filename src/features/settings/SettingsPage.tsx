import { useState } from 'react';
import { Card, CardHeader } from '@/components/ui/Card';
import { GeneralTab } from './GeneralTab';
import { NotificationsTab } from './NotificationsTab';
import { TeamTab } from './TeamTab';
import { BillingTab } from './BillingTab';
import { IntegrationsTab } from './IntegrationsTab';
import { DataTab } from './DataTab';

const TABS = ['General', 'Notifications', 'Team & roles', 'Billing', 'API & integrations', 'Data'] as const;
type Tab = (typeof TABS)[number];

const TAB_META: Record<Tab, string> = {
  General: 'Workspace preferences',
  Notifications: 'Choose what reaches your inbox',
  'Team & roles': 'Manage workspace access',
  Billing: 'Plan, usage, and invoices',
  'API & integrations': 'Keys and connected data sources',
  Data: 'What is stored, and how to reset it',
};

export function SettingsPage() {
  const [tab, setTab] = useState<Tab>('General');

  return (
    <div className="page-stack settings-layout">
      <div className="settings-tabs" role="tablist" aria-label="Settings sections">
        {TABS.map((item) => (
          <button
            key={item}
            role="tab"
            type="button"
            id={`tab-${item}`}
            aria-selected={tab === item}
            aria-controls={`panel-${item}`}
            className={tab === item ? 'active' : ''}
            onClick={() => setTab(item)}
          >
            {item}
          </button>
        ))}
      </div>
      <Card>
        <CardHeader title={tab} meta={TAB_META[tab]} />
        <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
          {tab === 'General' && <GeneralTab />}
          {tab === 'Notifications' && <NotificationsTab />}
          {tab === 'Team & roles' && <TeamTab />}
          {tab === 'Billing' && <BillingTab />}
          {tab === 'API & integrations' && <IntegrationsTab />}
          {tab === 'Data' && <DataTab />}
        </div>
      </Card>
    </div>
  );
}
