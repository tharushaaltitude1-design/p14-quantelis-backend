import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Avatar } from '@/components/ui/Avatar';

describe('Avatar', () => {
  it('renders initials when there is no photo', () => {
    render(<Avatar name="Alex Rivera" initials="AR" src={null} />);
    expect(screen.getByText('AR')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('renders the photo when one is available', () => {
    render(<Avatar name="Alex Rivera" initials="AR" src="https://example.test/a.png" alt="Alex Rivera profile photo" />);
    const img = screen.getByRole('img', { name: /profile photo/i });
    expect(img).toHaveAttribute('src', 'https://example.test/a.png');
  });

  it('marks the image decorative when no alt is supplied, so the name is not announced twice', () => {
    render(<Avatar name="Alex Rivera" initials="AR" src="https://example.test/a.png" />);
    expect(screen.getByRole('presentation')).toBeInTheDocument();
  });

  // A Google avatar URL can start returning 404, and blockers can cancel the request. A broken
  // image glyph in the topbar would look like a bug, so we degrade to initials instead.
  it('falls back to initials when the image fails to load', () => {
    render(<Avatar name="Alex Rivera" initials="AR" src="https://example.test/gone.png" />);
    fireEvent.error(screen.getByRole('presentation'));
    expect(screen.getByText('AR')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  // Suppressing failures per-URL (not per-component) means a later, valid photo still renders.
  it('renders a new photo URL after an earlier one failed', () => {
    const { rerender } = render(<Avatar name="Alex Rivera" initials="AR" src="https://example.test/gone.png" />);
    fireEvent.error(screen.getByRole('presentation'));
    expect(screen.getByText('AR')).toBeInTheDocument();

    rerender(<Avatar name="Alex Rivera" initials="AR" src="https://example.test/fresh.png" />);
    expect(screen.getByRole('presentation')).toHaveAttribute('src', 'https://example.test/fresh.png');
  });

  it('applies the size modifier class', () => {
    const { container } = render(<Avatar name="Alex Rivera" initials="AR" size="small" />);
    expect(container.firstElementChild).toHaveClass('avatar', 'avatar-small');
  });
});
