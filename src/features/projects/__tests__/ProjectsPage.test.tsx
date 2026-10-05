import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useNavigate, useSearchParams } from 'react-router-dom';
import { WorkspaceProvider } from '@/state/WorkspaceProvider';
import { ProjectsPage } from '../ProjectsPage';

/**
 * Stands in for the header: the button in `Topbar` navigates to `/projects?new=true`, which is the
 * route this page is already mounted on.
 */
function HeaderNewProjectButton() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  return (
    <button type="button" onClick={() => navigate('/projects?new=true')}>
      New project (header){params.toString()}
    </button>
  );
}

const renderPage = (initialEntry = '/projects') => {
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <WorkspaceProvider>
        <HeaderNewProjectButton />
        <ProjectsPage />
      </WorkspaceProvider>
    </MemoryRouter>,
  );
  return { user };
};

const wizard = () => screen.queryByRole('dialog', { name: /new forecasting project/i });

describe('ProjectsPage — the header New project button', () => {
  // Regression: the wizard's open state was seeded from the query string once, on mount. Pressing
  // the header button while already on /projects changed only the query params, so the mounted
  // component kept its state and the button looked inert.
  it('opens the wizard when pressed while the page is already showing', async () => {
    const { user } = renderPage();
    expect(wizard()).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /new project \(header\)/i }));

    expect(await screen.findByRole('dialog', { name: /new forecasting project/i })).toBeInTheDocument();
  });

  it('opens the wizard again after it has been dismissed', async () => {
    const { user } = renderPage();

    await user.click(screen.getByRole('button', { name: /new project \(header\)/i }));
    await screen.findByRole('dialog', { name: /new forecasting project/i });
    await user.click(screen.getByRole('button', { name: /close/i }));
    await waitFor(() => expect(wizard()).not.toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /new project \(header\)/i }));
    expect(await screen.findByRole('dialog', { name: /new forecasting project/i })).toBeInTheDocument();
  });

  it('still opens the wizard when the page is loaded directly with the flag set', async () => {
    renderPage('/projects?new=true');
    expect(await screen.findByRole('dialog', { name: /new forecasting project/i })).toBeInTheDocument();
  });

  it('does not re-open the wizard just because the page re-rendered', async () => {
    const { user } = renderPage();
    await user.click(screen.getByRole('button', { name: /new project \(header\)/i }));
    await screen.findByRole('dialog', { name: /new forecasting project/i });
    await user.click(screen.getByRole('button', { name: /close/i }));

    // The toolbar's own search field causes a plain state update, no navigation involved.
    await user.type(screen.getByRole('searchbox', { name: /search projects/i }), 'a');
    await waitFor(() => expect(wizard()).not.toBeInTheDocument());
  });
});
