import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { WorkspaceProvider } from '@/state/WorkspaceProvider';
import { NotificationsMenu } from '../NotificationsMenu';

const renderMenu = () => {
  const onNavigate = vi.fn();
  render(
    <MemoryRouter>
      <WorkspaceProvider>
        <NotificationsMenu onNavigate={onNavigate} />
      </WorkspaceProvider>
    </MemoryRouter>,
  );
  return { onNavigate };
};

describe('NotificationsMenu', () => {
  it('opens a positioned panel from the bell', async () => {
    const user = userEvent.setup();
    renderMenu();

    const bell = screen.getByRole('button', { name: /notifications/i });
    expect(bell).toHaveAttribute('aria-expanded', 'false');

    await user.click(bell);
    expect(bell).toHaveAttribute('aria-expanded', 'true');

    const panel = await screen.findByRole('dialog', { name: /notifications/i });
    // Regression: the panel must carry the shared fixed-position surface class, otherwise
    // it renders in the document flow at the bottom of <body> and looks like a dead button.
    expect(panel).toHaveClass('popover-panel');
  });

  it('marks every notification read and updates the unread count', async () => {
    const user = userEvent.setup();
    renderMenu();

    const bell = screen.getByRole('button', { name: /notifications, 3 unread/i });
    await user.click(bell);

    const panel = await screen.findByRole('dialog', { name: /notifications/i });
    expect(within(panel).getByText('3 unread updates')).toBeInTheDocument();

    await user.click(within(panel).getByRole('button', { name: /mark all read/i }));

    await waitFor(() => expect(screen.getByRole('button', { name: /^Notifications$/ })).toBeInTheDocument());
    expect(within(screen.getByRole('dialog')).getByText('All caught up')).toBeInTheDocument();
    expect(bell).toBeTruthy();
  });

  it('marks a single notification read, closes, and navigates to its target', async () => {
    const user = userEvent.setup();
    const { onNavigate } = renderMenu();

    await user.click(screen.getByRole('button', { name: /notifications/i }));
    const panel = await screen.findByRole('dialog', { name: /notifications/i });

    await user.click(within(panel).getByRole('button', { name: /forecast completed/i }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(onNavigate).toHaveBeenCalledWith('/projects');
    expect(screen.getByRole('button', { name: /notifications, 2 unread/i })).toBeInTheDocument();
  });

  it('closes on an outside click and on Escape', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <MemoryRouter>
          <WorkspaceProvider>
            <NotificationsMenu onNavigate={vi.fn()} />
          </WorkspaceProvider>
        </MemoryRouter>
        <button type="button">Elsewhere</button>
      </div>,
    );

    await user.click(screen.getByRole('button', { name: /notifications/i }));
    expect(await screen.findByRole('dialog', { name: /notifications/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Elsewhere' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /notifications/i }));
    expect(await screen.findByRole('dialog', { name: /notifications/i })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('disables mark-all-read when there is nothing unread', async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.click(screen.getByRole('button', { name: /notifications/i }));
    const panel = await screen.findByRole('dialog', { name: /notifications/i });
    await user.click(within(panel).getByRole('button', { name: /mark all read/i }));

    await waitFor(() => expect(within(screen.getByRole('dialog')).getByRole('button', { name: /mark all read/i })).toBeDisabled());
  });
});
