import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SignInPage } from '../SignInPage';
import { AuthTestProvider } from '@/test/authTestUtils';
import { makeAuthValue } from '@/test/authFixtures';

function renderPage(auth = makeAuthValue(), initialEntry = '/login') {
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <AuthTestProvider value={auth}>
        <Routes>
          <Route path="/login" element={<SignInPage />} />
          <Route path="/" element={<h1>Overview</h1>} />
          <Route path="/datasets" element={<h1>Datasets</h1>} />
        </Routes>
      </AuthTestProvider>
    </MemoryRouter>,
  );
  return { user, auth };
}

const fillCredentials = async (user: ReturnType<typeof userEvent.setup>, email: string, password: string) => {
  await user.type(screen.getByLabelText(/work email/i), email);
  await user.type(screen.getByLabelText(/^password$/i), password);
};

describe('SignInPage', () => {
  it('renders the credential form and the sign-up hand-off', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /sign in to quantelis/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/work email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toHaveAttribute('type', 'password');
    expect(screen.getByRole('link', { name: /create an account/i })).toHaveAttribute('href', '/signup');
  });

  it('blocks submission and reports both problems when empty', async () => {
    const { user, auth } = renderPage();
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));

    expect(auth.signIn).not.toHaveBeenCalled();
    expect(await screen.findByText('Enter your email address.')).toBeInTheDocument();
    expect(screen.getByText('Enter your password.')).toBeInTheDocument();
  });

  it('rejects a malformed email before calling Firebase', async () => {
    const { user, auth } = renderPage();
    await fillCredentials(user, 'alex@', 'forecast2026');
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));

    expect(auth.signIn).not.toHaveBeenCalled();
    expect(await screen.findByText(/does not look like a valid email/i)).toBeInTheDocument();
  });

  it('signs in and returns the user to the page they originally wanted', async () => {
    const { user, auth } = renderPage(makeAuthValue(), '/login');
    await fillCredentials(user, '  alex.rivera@quantelis.lk ', 'forecast2026');
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));

    await waitFor(() => expect(auth.signIn).toHaveBeenCalledWith('alex.rivera@quantelis.lk', 'forecast2026'));
    // No `from` in location state, so the user lands on the overview.
    expect(await screen.findByRole('heading', { name: /overview/i })).toBeInTheDocument();
  });

  it('surfaces a friendly message instead of a raw Firebase error code', async () => {
    const signIn = vi.fn().mockRejectedValue(new Error('That email and password combination did not match an account.'));
    const { user } = renderPage(makeAuthValue({ signIn }));
    await fillCredentials(user, 'alex.rivera@quantelis.lk', 'wrongpassword');
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/did not match an account/i);
    expect(alert).not.toHaveTextContent(/auth\//i);
  });

  it('requires a valid email before sending a reset email', async () => {
    const { user, auth } = renderPage();
    await user.click(screen.getByRole('button', { name: /forgot password/i }));

    expect(auth.sendResetEmail).not.toHaveBeenCalled();
    expect(await screen.findByText('Enter your email address.')).toBeInTheDocument();
  });

  it('sends a reset email for a valid address without revealing whether it exists', async () => {
    const { user, auth } = renderPage();
    await user.type(screen.getByLabelText(/work email/i), 'alex.rivera@quantelis.lk');
    await user.click(screen.getByRole('button', { name: /forgot password/i }));

    await waitFor(() => expect(auth.sendResetEmail).toHaveBeenCalledWith('alex.rivera@quantelis.lk'));
    expect(await screen.findByRole('status')).toHaveTextContent(/if that address has an account/i);
  });

  it('toggles password visibility from the icon button', async () => {
    const { user } = renderPage();
    await user.click(screen.getByRole('button', { name: /show password/i }));
    expect(screen.getByLabelText(/^password$/i)).toHaveAttribute('type', 'text');
    await user.click(screen.getByRole('button', { name: /hide password/i }));
    expect(screen.getByLabelText(/^password$/i)).toHaveAttribute('type', 'password');
  });

  it('warns when Firebase is not configured instead of failing silently', () => {
    renderPage(makeAuthValue({ isDemoMode: true }));
    expect(screen.getByRole('status')).toHaveTextContent(/firebase is not configured/i);
  });

  it('offers Google sign-in and lands in the workspace on success', async () => {
    const { user, auth } = renderPage();
    await user.click(screen.getByRole('button', { name: /sign in with google/i }));

    await waitFor(() => expect(auth.signInWithGoogle).toHaveBeenCalled());
    expect(auth.signIn).not.toHaveBeenCalled();
    expect(await screen.findByRole('heading', { name: /overview/i })).toBeInTheDocument();
  });

  it('explains a blocked Google popup instead of failing silently', async () => {
    const signInWithGoogle = vi
      .fn()
      .mockRejectedValue(new Error('Your browser blocked the Google sign-in window. Allow pop-ups for this site, then try again.'));
    const { user } = renderPage(makeAuthValue({ signInWithGoogle }));
    await user.click(screen.getByRole('button', { name: /sign in with google/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/blocked the google sign-in window/i);
    // The form stays put so the user can retry.
    expect(screen.getByRole('heading', { name: /sign in to quantelis/i })).toBeInTheDocument();
  });

  it('links the legal documents and opens them in a new tab', () => {
    renderPage();
    const terms = screen.getByRole('link', { name: /terms of service/i });
    const privacy = screen.getByRole('link', { name: /privacy policy/i });

    expect(terms).toHaveAttribute('href', 'https://quantelis.lk/terms');
    expect(privacy).toHaveAttribute('href', 'https://quantelis.lk/privacy');
    for (const link of [terms, privacy]) {
      expect(link).toHaveAttribute('target', '_blank');
      // `noopener` stops the opened page reaching back through window.opener.
      expect(link.getAttribute('rel')).toContain('noopener');
      expect(link.getAttribute('rel')).toContain('noreferrer');
    }
  });
});
