import { describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { WorkspaceProvider } from '@/state/WorkspaceProvider';
import { ScenariosPage } from '../ScenariosPage';

const MAX_COMPARE = 4;

const renderPage = () =>
  render(
    <MemoryRouter>
      <WorkspaceProvider>
        <ScenariosPage />
      </WorkspaceProvider>
    </MemoryRouter>,
  );

const compareBoxes = () => screen.getAllByRole('checkbox', { name: /^Compare / });

describe('ScenariosPage', () => {
  it('selects scenarios for comparison and refuses to exceed the cap', async () => {
    const user = userEvent.setup();
    renderPage();

    // Duplicate one row so the library holds more scenarios than the comparison cap.
    await user.click(screen.getAllByRole('button', { name: /options for /i })[0]);
    await user.click(await screen.findByRole('menuitem', { name: /duplicate/i }));

    const boxes = compareBoxes();
    expect(boxes.length).toBeGreaterThan(MAX_COMPARE);

    // Select the first four.
    for (const box of boxes.slice(0, MAX_COMPARE)) {
      await user.click(box);
    }
    expect(screen.getByRole('region', { name: /scenario comparison/i })).toHaveTextContent('4 of 4 selected');

    // The next unchecked scenario cannot be added.
    const overflow = compareBoxes()[MAX_COMPARE];
    expect(overflow).toBeDisabled();
    expect(overflow).toHaveAttribute('aria-checked', 'false');
    await user.click(overflow);
    expect(screen.getByRole('region', { name: /scenario comparison/i })).toHaveTextContent('4 of 4 selected');
  });

  it('deselects a scenario when its checkbox is clicked again', async () => {
    const user = userEvent.setup();
    renderPage();

    const first = compareBoxes()[0];
    await user.click(first);
    expect(first).toHaveAttribute('aria-checked', 'true');
    await user.click(compareBoxes()[0]);
    expect(compareBoxes()[0]).toHaveAttribute('aria-checked', 'false');
  });

  it('keeps the compare button disabled until two scenarios are picked', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(compareBoxes()[0]);
    const compareButton = screen.getByRole('button', { name: /compare 1/i });
    expect(compareButton).toBeDisabled();

    await user.click(compareBoxes()[1]);
    expect(screen.getByRole('button', { name: /compare 2/i })).toBeEnabled();
  });

  it('opens a comparison table that ranks the highest score', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(compareBoxes()[0]);
    await user.click(compareBoxes()[1]);
    await user.click(screen.getByRole('button', { name: /compare 2/i }));

    const table = await screen.findByRole('table', { name: /scenario comparison/i });
    expect(within(table).getByRole('rowheader', { name: 'Outcome score' })).toBeInTheDocument();
    expect(within(table).getByRole('rowheader', { name: 'Objective' })).toBeInTheDocument();
    expect(screen.getByText(/leads with the highest outcome score/i)).toBeInTheDocument();
  });

  it('clears the whole selection from the compare bar', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(compareBoxes()[0]);
    await user.click(compareBoxes()[1]);
    expect(screen.getByRole('region', { name: /scenario comparison/i })).toHaveTextContent('2 of 4 selected');

    await user.click(screen.getByRole('button', { name: /^clear$/i }));
    await waitFor(() => expect(screen.queryByText(/of 4 selected/)).not.toBeInTheDocument());
  });

  it('removes a single scenario from the compare bar', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(compareBoxes()[0]);
    const chip = screen.getByRole('button', { name: /remove .* from comparison/i });
    await user.click(chip);
    await waitFor(() => expect(screen.queryByRole('region', { name: /scenario comparison/i })).not.toBeInTheDocument());
  });

  it('creates a scenario through the create dialog', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /create scenario/i }));
    const dialog = await screen.findByRole('dialog', { name: /create scenario/i });

    const nameInput = within(dialog).getByRole('textbox', { name: /^name$/i });
    await user.type(nameInput, 'Stress case');
    const paramsInput = within(dialog).getByRole('textbox', { name: /parameters/i });
    await user.type(paramsInput, '+20% demand');
    await user.click(within(dialog).getByRole('button', { name: /create scenario/i }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await screen.findByText('Stress case')).toBeInTheDocument();
  });

  it('rejects a scenario with an out-of-range score', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /create scenario/i }));
    const dialog = await screen.findByRole('dialog', { name: /create scenario/i });

    await user.type(within(dialog).getByRole('textbox', { name: /^name$/i }), 'Bad score');
    await user.type(within(dialog).getByRole('textbox', { name: /parameters/i }), '+20% demand');
    const scoreInput = within(dialog).getByLabelText(/outcome score/i);
    await user.clear(scoreInput);
    await user.type(scoreInput, '500');
    await user.click(within(dialog).getByRole('button', { name: /create scenario/i }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/between 0 and 100/i);
    expect(screen.getByRole('dialog', { name: /create scenario/i })).toBeInTheDocument();
  });

  it('filters the library by objective', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Filter' }));
    const menu = await screen.findByRole('menu');
    await user.click(within(menu).getByRole('menuitem', { name: 'Maximize accuracy' }));

    await waitFor(() => {
      const names = screen.getAllByRole('checkbox', { name: /^Compare / });
      expect(names).toHaveLength(1);
    });
  });
});
