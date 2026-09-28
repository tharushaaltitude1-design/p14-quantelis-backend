import { useState } from 'react';
import { UserMinus, UserPlus } from 'lucide-react';
import { Menu, type MenuEntry } from '@/components/ui/Menu';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { JOB_ROLES, WORKSPACE_ROLES, type TeamMember } from '@/data/mock';
import { useWorkspace, useWorkspaceDispatch } from '@/state/workspaceContext';

const initials = (name: string) =>
  name
    .split(' ')
    .map((part) => part[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();

export function TeamTab() {
  const { team, profile } = useWorkspace();
  const dispatch = useWorkspaceDispatch();
  const [inviting, setInviting] = useState(false);
  const [removing, setRemoving] = useState<TeamMember | null>(null);

  return (
    <div className="team-list">
      {team.map((member) => {
        const isSelf = member.name === profile.fullName;
        const entries: MenuEntry[] = [
          { id: 'promote', kind: 'label', text: 'Change role' },
          ...WORKSPACE_ROLES.filter((role) => role !== member.role).map((role) => ({
            id: `role-${role}`,
            label: `Make ${role}`,
            onSelect: () => {
              dispatch({ type: 'team/setRole', id: member.id, role });
              dispatch({ type: 'toast/push', toast: { kind: 'success', title: 'Role updated', message: `${member.name} is now ${role}.` } });
            },
          })),
          { id: 'team-sep', kind: 'separator' },
          {
            id: 'remove',
            label: isSelf ? 'Leave workspace' : 'Remove from workspace',
            icon: UserMinus,
            danger: true,
            disabled: isSelf,
            onSelect: () => setRemoving(member),
          },
        ];
        return (
          <div className="team-row" key={member.id}>
            <span className="avatar">{initials(member.name)}</span>
            <span>
              <b>
                {member.name}
                {isSelf ? ' (you)' : ''}
              </b>
              <small>
                {member.jobTitle}
                {member.invited ? ' · invitation pending' : ''}
              </small>
            </span>
            <span className="role-badge">{member.role}</span>
            <Menu label={`Options for ${member.name}`} entries={entries} />
          </div>
        );
      })}
      <button type="button" className="secondary-button" onClick={() => setInviting(true)}>
        <UserPlus size={16} /> Invite member
      </button>
      {inviting && <InviteDialog onClose={() => setInviting(false)} />}
      {removing && (
        <ConfirmDialog
          title="Remove this member?"
          message={`${removing.name} will lose access to the workspace immediately. This cannot be undone.`}
          confirmLabel="Remove member"
          onCancel={() => setRemoving(null)}
          onConfirm={() => {
            dispatch({ type: 'team/remove', id: removing.id });
            dispatch({ type: 'toast/push', toast: { kind: 'success', title: 'Member removed', message: `${removing.name} no longer has workspace access.` } });
            setRemoving(null);
          }}
        />
      )}
    </div>
  );
}

function InviteDialog({ onClose }: { onClose: () => void }) {
  const dispatch = useWorkspaceDispatch();
  const [name, setName] = useState('');
  const [jobTitle, setJobTitle] = useState(JOB_ROLES[0]);
  const [role, setRole] = useState<string>(WORKSPACE_ROLES[1]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const submit = () => {
    if (name.trim().length < 2) {
      setError('Enter the full name of the person you are inviting.');
      return;
    }
    setError('');
    setSending(true);
    window.setTimeout(() => {
      dispatch({ type: 'team/invite', name: name.trim(), jobTitle, role: role as TeamMember['role'] });
      dispatch({ type: 'toast/push', toast: { kind: 'success', title: 'Invitation sent', message: `${name.trim()} was invited as ${role}.` } });
      setSending(false);
      onClose();
    }, 650);
  };

  return (
    <Modal title="Invite a team member" onClose={onClose}>
      <div className="wizard-content">
        <label className="field-label" htmlFor="invite-name">
          Full name
        </label>
        <input
          id="invite-name"
          className="text-input wizard-input"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setError('');
          }}
          placeholder="e.g. Priya Raman"
          aria-invalid={error ? true : undefined}
        />
        <label className="field-label" htmlFor="invite-title">
          Job title
        </label>
        <Select id="invite-title" value={jobTitle} onChange={setJobTitle} options={JOB_ROLES} label="Job title" className="wizard-select" />
        <label className="field-label" htmlFor="invite-role">
          Workspace role
        </label>
        <Select id="invite-role" value={role} onChange={setRole} options={WORKSPACE_ROLES} label="Workspace role" className="wizard-select" />
        {error && (
          <span className="field-error" role="alert">
            {error}
          </span>
        )}
      </div>
      <div className="modal-actions">
        <button type="button" className="secondary-button" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="primary-button" onClick={submit} disabled={sending}>
          {sending ? 'Sending…' : 'Send invitation'}
        </button>
      </div>
    </Modal>
  );
}
