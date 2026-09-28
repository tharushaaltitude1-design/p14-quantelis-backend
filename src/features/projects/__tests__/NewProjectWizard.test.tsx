import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { WorkspaceProvider } from '@/state/WorkspaceProvider';
import { NewProjectWizard } from '../NewProjectWizard';

function renderWizard() {
  const onClose = vi.fn();
  const onCreated = vi.fn();
  render(
    <MemoryRouter>
      <WorkspaceProvider>
        <NewProjectWizard onClose={onClose} onCreated={onCreated} />
      </WorkspaceProvider>
    </MemoryRouter>,
  );
  return { onClose, onCreated };
}

const continueButton = () => screen.getByRole('button', { name: /continue/i });

describe('NewProjectWizard', () => {
  it('walks the steps and shows a progress bar while the forecast runs', async () => {
    const user = userEvent.setup();
    renderWizard();

    expect(screen.getByRole('dialog', { name: /new forecasting project/i })).toBeInTheDocument();

    // Step 1: pick the dataset and name the project.
    const nameInput = screen.getByRole('textbox', { name: /project name/i });
    await user.clear(nameInput);
    await user.type(nameInput, 'Test demand plan');
    await user.click(continueButton());

    // Step 2: configure.
    expect(await screen.findByText('Configure the forecast')).toBeInTheDocument();
    await user.click(continueButton());

    // Step 3: review.
    expect(await screen.findByText('Review run parameters')).toBeInTheDocument();
    expect(screen.getByText('Test demand plan')).toBeInTheDocument();
    await user.click(continueButton());

    expect(await screen.findByText('Ready to run')).toBeInTheDocument();

    // Step 4: running state, then the success screen.
    await user.click(screen.getByRole('button', { name: /run forecast/i }));
    expect(await screen.findByText(/building your forecast model/i)).toBeInTheDocument();
    expect(await screen.findByText(/forecast complete/i, undefined, { timeout: 5000 })).toBeInTheDocument();
  });

  it('suggests a project name from the dataset and lets the user replace it', async () => {
    renderWizard();
    const nameInput = screen.getByRole('textbox', { name: /project name/i });
    // The dataset is auto-selected and its name is offered as a starting point.
    expect((nameInput as HTMLInputElement).value).toMatch(/plan$/);
  });

  it('blocks step 1 when the name is cleared or too short', async () => {
    const user = userEvent.setup();
    renderWizard();

    const nameInput = screen.getByRole('textbox', { name: /project name/i });
    await user.clear(nameInput);
    await user.click(continueButton());
    expect(await screen.findByRole('alert')).toHaveTextContent(/at least 3 characters/i);
    expect(screen.queryByText('Configure the forecast')).not.toBeInTheDocument();

    await user.type(nameInput, 'ab');
    await user.click(continueButton());
    expect(await screen.findByRole('alert')).toHaveTextContent(/at least 3 characters/i);
  });

  it('can go back from a later step without losing the name', async () => {
    const user = userEvent.setup();
    renderWizard();

    const nameInput = screen.getByRole('textbox', { name: /project name/i });
    await user.clear(nameInput);
    await user.type(nameInput, 'Backwards');
    await user.click(continueButton());
    expect(await screen.findByText('Configure the forecast')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^back$/i }));
    expect(await screen.findByRole('textbox', { name: /project name/i })).toHaveValue('Backwards');
  });

  it('closes on Escape without creating anything', async () => {
    const user = userEvent.setup();
    const { onClose } = renderWizard();

    await user.keyboard('{Escape}');
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('warns when a project with the same name already exists at review', async () => {
    const user = userEvent.setup();
    renderWizard();

    const nameInput = screen.getByRole('textbox', { name: /project name/i });
    await user.clear(nameInput);
    await user.type(nameInput, 'East Coast Demand Plan');
    await user.click(continueButton());
    await user.click(await screen.findByRole('button', { name: /continue/i }));

    expect(await screen.findByText('Review run parameters')).toBeInTheDocument();
    expect(screen.getByText(/already exists/i)).toBeInTheDocument();
  });

  it('passes the created project to onCreated from the success screen', async () => {
    const user = userEvent.setup();
    const { onCreated, onClose } = renderWizard();

    await user.clear(screen.getByRole('textbox', { name: /project name/i }));
    await user.type(screen.getByRole('textbox', { name: /project name/i }), 'Created project');
    await user.click(continueButton());
    await user.click(await screen.findByRole('button', { name: /continue/i }));
    await user.click(await screen.findByRole('button', { name: /continue/i }));
    await user.click(await screen.findByRole('button', { name: /run forecast/i }));

    const viewResults = await screen.findByRole('button', { name: /view results/i }, { timeout: 5000 });
    await user.click(viewResults);

    expect(onCreated).toHaveBeenCalledTimes(1);
    expect(onCreated.mock.calls[0][0]).toMatchObject({ name: 'Created project', status: 'Active' });
    expect(onClose).toHaveBeenCalled();
  });
});
