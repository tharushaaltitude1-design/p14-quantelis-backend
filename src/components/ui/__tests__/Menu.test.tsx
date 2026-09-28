import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Menu, type MenuEntry } from '../Menu';

const entries: MenuEntry[] = [
  { id: 'edit', label: 'Edit' },
  { id: 'duplicate', label: 'Duplicate' },
  { id: 'sep', kind: 'separator' },
  { id: 'delete', label: 'Delete', danger: true },
];

describe('Menu', () => {
  it('opens from the default 3-dot trigger and exposes menu semantics', async () => {
    const user = userEvent.setup();
    render(<Menu label="Row options" entries={entries} />);

    const trigger = screen.getByRole('button', { name: 'Row options' });
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await user.click(trigger);

    const menu = screen.getByRole('menu');
    expect(menu).toBeInTheDocument();
    expect(screen.getAllByRole('menuitem')).toHaveLength(3);
    expect(screen.getByRole('separator')).toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  it('moves focus with the arrow keys and activates an item with Enter', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<Menu label="Row options" entries={[{ id: 'edit', label: 'Edit', onSelect }, { id: 'duplicate', label: 'Duplicate' }]} />);

    await user.click(screen.getByRole('button', { name: 'Row options' }));
    expect(screen.getByRole('menuitem', { name: 'Edit' })).toHaveFocus();

    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Duplicate' })).toHaveFocus();

    // Wraps around to the first item.
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Edit' })).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('jumps to the last item with End and the first with Home', async () => {
    const user = userEvent.setup();
    render(<Menu label="Row options" entries={entries} />);

    await user.click(screen.getByRole('button', { name: 'Row options' }));
    await user.keyboard('{End}');
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toHaveFocus();

    await user.keyboard('{Home}');
    expect(screen.getByRole('menuitem', { name: 'Edit' })).toHaveFocus();
  });

  it('closes on Escape and returns focus to the trigger', async () => {
    const user = userEvent.setup();
    render(<Menu label="Row options" entries={entries} />);

    const trigger = screen.getByRole('button', { name: 'Row options' });
    await user.click(trigger);
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('closes on an outside click', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <Menu label="Row options" entries={entries} />
        <button type="button">Somewhere else</button>
      </div>,
    );

    await user.click(screen.getByRole('button', { name: 'Row options' }));
    expect(screen.getByRole('menu')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Somewhere else' }));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('does not call onSelect for a disabled item', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<Menu label="Row options" entries={[{ id: 'disabled', label: 'Delete', disabled: true, onSelect }]} />);

    await user.click(screen.getByRole('button', { name: 'Row options' }));
    const item = screen.getByRole('menuitem', { name: 'Delete' });
    expect(item).toBeDisabled();

    await user.click(item);
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('renders a custom trigger and shows checkmarks for checked entries', async () => {
    const user = userEvent.setup();
    render(
      <Menu
        label="Details"
        entries={[{ id: 'a', label: 'Validated', checked: true }, { id: 'b', label: 'Pending' }]}
        trigger={(props) => (
          <button {...props} type="button">
            Details
          </button>
        )}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Details' }));
    expect(screen.getByRole('menuitem', { name: /Validated/ })).toHaveTextContent('Validated');
    expect(document.querySelector('.menu-check')).toBeInTheDocument();
  });

  it('notifies the parent when the menu opens and closes', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<Menu label="Row options" entries={entries} onOpenChange={onOpenChange} />);

    const trigger = screen.getByRole('button', { name: 'Row options' });
    await user.click(trigger);
    expect(onOpenChange).toHaveBeenLastCalledWith(true);

    await user.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });
});
