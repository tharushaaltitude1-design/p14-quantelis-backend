import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { WorkspaceProvider } from '@/state/WorkspaceProvider';
import { DatasetsPage } from '../DatasetsPage';

const renderPage = () =>
  render(
    <MemoryRouter>
      <WorkspaceProvider>
        <DatasetsPage />
      </WorkspaceProvider>
    </MemoryRouter>,
  );

const rowMenuButtons = () => screen.queryAllByRole('button', { name: /^Options for/ });

describe('DatasetsPage', () => {
  it('filters rows through the shared search box and shows an empty state', async () => {
    const user = userEvent.setup();
    renderPage();

    const initialRows = rowMenuButtons().length;
    expect(initialRows).toBeGreaterThan(0);

    await user.type(screen.getByRole('searchbox', { name: /search datasets/i }), 'zzzz-no-such-dataset');

    await waitFor(() => expect(screen.getByText('No datasets found')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /clear search and filters/i })).toBeInTheDocument();
    expect(rowMenuButtons()).toHaveLength(0);
  });

  it('recovers from an empty search with the empty-state action', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByRole('searchbox', { name: /search datasets/i }), 'zzzz');
    await waitFor(() => expect(screen.getByText('No datasets found')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /clear search and filters/i }));

    await waitFor(() => expect(screen.queryByText('No datasets found')).not.toBeInTheDocument());
    expect(screen.getByRole('searchbox', { name: /search datasets/i })).toHaveValue('');
    expect(rowMenuButtons().length).toBeGreaterThan(0);
  });

  it('narrows the list when searching a real term and shows the total', async () => {
    const user = userEvent.setup();
    renderPage();

    const before = rowMenuButtons().length;
    await user.type(screen.getByRole('searchbox', { name: /search datasets/i }), 'grid');
    await waitFor(() => expect(rowMenuButtons().length).toBeLessThan(before));
    expect(screen.getByText(/Showing/)).toBeInTheDocument();
  });

  it('applies a status filter and reflects the active filter count', async () => {
    const user = userEvent.setup();
    renderPage();

    const filterButton = screen.getByRole('button', { name: 'Filter' });
    await user.click(filterButton);

    const menu = await screen.findByRole('menu');
    await user.click(within(menu).getByRole('menuitem', { name: 'Validated' }));

    await waitFor(() => {
      const count = filterButton.querySelector('.filter-count');
      expect(count).toHaveTextContent('1');
    });

    // The filter menu now offers a clear-all entry that restores the full list.
    await user.click(filterButton);
    const reopened = await screen.findByRole('menu');
    expect(within(reopened).getByRole('menuitem', { name: /clear all filters/i })).toBeInTheDocument();
    await user.click(within(reopened).getByRole('menuitem', { name: /clear all filters/i }));

    await waitFor(() => expect(filterButton.querySelector('.filter-count')).toBeNull());
  });

  it('asks for confirmation before deleting a dataset and cancels safely', async () => {
    const user = userEvent.setup();
    renderPage();

    const before = rowMenuButtons().length;
    await user.click(rowMenuButtons()[0]);
    const menu = await screen.findByRole('menu');
    await user.click(within(menu).getByRole('menuitem', { name: 'Delete' }));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent(/will be removed from the workspace/i);

    await user.click(within(dialog).getByRole('button', { name: /^cancel$/i }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(rowMenuButtons()).toHaveLength(before);
  });

  it('deletes a dataset once the confirmation is accepted', async () => {
    const user = userEvent.setup();
    renderPage();

    const before = rowMenuButtons().length;
    await user.click(rowMenuButtons()[0]);
    const menu = await screen.findByRole('menu');
    await user.click(within(menu).getByRole('menuitem', { name: 'Delete' }));

    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /^delete dataset$/i }));

    await waitFor(() => expect(rowMenuButtons()).toHaveLength(before - 1));
  });

  it('renames a dataset through the shared prompt dialog', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(rowMenuButtons()[0]);
    const menu = await screen.findByRole('menu');
    await user.click(within(menu).getByRole('menuitem', { name: 'Rename' }));

    const dialog = await screen.findByRole('dialog');
    const input = within(dialog).getByRole('textbox', { name: /dataset name/i });
    await user.clear(input);
    await user.type(input, 'Renamed by test');
    await user.click(within(dialog).getByRole('button', { name: /^save$/i }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await screen.findByText('Renamed by test')).toBeInTheDocument();
  });

  it('exports the visible rows through the toolbar menu', async () => {
    const user = userEvent.setup();
    const createObjectURL = vi.fn().mockReturnValue('blob:mock');
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });

    renderPage();

    await user.click(screen.getByRole('button', { name: 'Dataset toolbar options' }));
    const menu = await screen.findByRole('menu');
    await user.click(within(menu).getByRole('menuitem', { name: /export filtered as csv/i }));

    await waitFor(() => expect(createObjectURL).toHaveBeenCalled());
  });
});
