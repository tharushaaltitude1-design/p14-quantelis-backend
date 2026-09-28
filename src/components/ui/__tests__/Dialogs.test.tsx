import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDialog } from '../ConfirmDialog';
import { PromptDialog } from '../PromptDialog';

describe('ConfirmDialog', () => {
  it('renders the title and message and confirms', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<ConfirmDialog title="Delete this project?" message="This cannot be undone." confirmLabel="Delete project" onConfirm={onConfirm} onCancel={vi.fn()} />);

    expect(screen.getByRole('dialog', { name: 'Delete this project?' })).toBeInTheDocument();
    expect(screen.getByText('This cannot be undone.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Delete project' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('cancels without confirming', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<ConfirmDialog title="Delete?" message="Gone forever." onConfirm={onConfirm} onCancel={onCancel} />);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('closes on Escape via onCancel', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<ConfirmDialog title="Delete?" message="Gone forever." onConfirm={vi.fn()} onCancel={onCancel} />);

    await user.keyboard('{Escape}');
    await waitFor(() => expect(onCancel).toHaveBeenCalled());
  });
});

describe('PromptDialog', () => {
  it('submits the edited value', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<PromptDialog title="Rename dataset" label="Dataset name" initialValue="Original name" onSubmit={onSubmit} onCancel={vi.fn()} />);

    const input = screen.getByRole('textbox', { name: /dataset name/i });
    expect(input).toHaveValue('Original name');

    await user.clear(input);
    await user.type(input, 'Renamed dataset');
    await user.click(screen.getByRole('button', { name: /save/i }));

    expect(onSubmit).toHaveBeenCalledWith('Renamed dataset');
  });

  it('trims whitespace before submitting', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<PromptDialog title="Rename dataset" label="Dataset name" initialValue="Original" onSubmit={onSubmit} onCancel={vi.fn()} />);

    const input = screen.getByRole('textbox', { name: /dataset name/i });
    await user.clear(input);
    await user.type(input, '   Padded   ');
    await user.click(screen.getByRole('button', { name: /save/i }));

    expect(onSubmit).toHaveBeenCalledWith('Padded');
  });

  it('submits on Enter', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<PromptDialog title="Rename dataset" label="Dataset name" onSubmit={onSubmit} onCancel={vi.fn()} />);

    const input = screen.getByRole('textbox', { name: /dataset name/i });
    await user.type(input, 'Keyboard save{Enter}');

    expect(onSubmit).toHaveBeenCalledWith('Keyboard save');
  });

  it('refuses an empty value and shows an error', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<PromptDialog title="Rename dataset" label="Dataset name" initialValue="Something" onSubmit={onSubmit} onCancel={vi.fn()} />);

    const input = screen.getByRole('textbox', { name: /dataset name/i });
    await user.clear(input);
    await user.click(screen.getByRole('button', { name: /save/i }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(await screen.findByRole('alert')).toHaveTextContent('This field is required.');
  });

  it('surfaces a custom validation message', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <PromptDialog
        title="Rename dataset"
        label="Dataset name"
        initialValue="abc"
        validate={(value) => (value.length < 5 ? 'Use at least 5 characters.' : null)}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /save/i }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(await screen.findByRole('alert')).toHaveTextContent('Use at least 5 characters.');
  });
});
