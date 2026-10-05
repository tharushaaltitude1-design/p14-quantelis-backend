import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ForgotPasswordPage } from '../ForgotPasswordPage';
import { ResetPasswordPage } from '../ResetPasswordPage';
import { AuthTestProvider } from '@/test/authTestUtils';
import { makeAuthValue } from '@/test/authFixtures';
import type { AuthContextValue } from '@/state/authContext';

const renderForgot = (auth = makeAuthValue(), state: unknown = undefined) => {
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={[{ pathname: '/forgot-password', state }]}>
      <AuthTestProvider value={auth}>
        <Routes>
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/login" element={<h1>Sign in</h1>} />
        </Routes>
      </AuthTestProvider>
    </MemoryRouter>,
  );
  return { user, auth };
};

const renderReset = (auth = makeAuthValue(), query = '?oobCode=code-123') => {
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={[`/reset-password${query}`]}>
      <AuthTestProvider value={auth}>
        <Routes>
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/forgot-password" element={<h1>Forgot password</h1>} />
          <Route path="/login" element={<h1>Sign in</h1>} />
        </Routes>
      </AuthTestProvider>
    </MemoryRouter>,
  );
  return { user, auth };
};

describe('ForgotPasswordPage', () => {
  it('rejects an empty or malformed address before calling Firebase', async () => {
    const { user, auth } = renderForgot();
    await user.click(screen.getByRole('button', { name: /send reset link/i }));
    expect(auth.sendResetEmail).not.toHaveBeenCalled();
    expect(await screen.findByText('Enter your email address.')).toBeInTheDocument();

    await user.type(screen.getByLabelText(/work email/i), 'alex@');
    await user.click(screen.getByRole('button', { name: /send reset link/i }));
    expect(await screen.findByText(/does not look like a valid email/i)).toBeInTheDocument();
    expect(auth.sendResetEmail).not.toHaveBeenCalled();
  });

  it('sends the link and answers without revealing whether the account exists', async () => {
    const { user, auth } = renderForgot();
    await user.type(screen.getByLabelText(/work email/i), 'alex.rivera@quantelis.lk');
    await user.click(screen.getByRole('button', { name: /send reset link/i }));

    await waitFor(() => expect(auth.sendResetEmail).toHaveBeenCalledWith('alex.rivera@quantelis.lk'));
    expect(await screen.findByRole('status')).toHaveTextContent(/if that address has an account/i);
  });

  it('prefills the address carried over from the sign-in screen', () => {
    renderForgot(makeAuthValue(), { email: 'alex.rivera@quantelis.lk' });
    expect(screen.getByLabelText(/work email/i)).toHaveValue('alex.rivera@quantelis.lk');
  });

  it('lets a wrong address be corrected instead of leaving the page', async () => {
    const { user } = renderForgot();
    await user.type(screen.getByLabelText(/work email/i), 'alex@quantelis.lk');
    await user.click(screen.getByRole('button', { name: /send reset link/i }));
    await screen.findByRole('status');

    await user.click(screen.getByRole('button', { name: /use a different email/i }));
    expect(screen.getByRole('button', { name: /send reset link/i })).toBeInTheDocument();
  });

  it('surfaces a delivery failure instead of claiming the email was sent', async () => {
    const sendResetEmail = vi.fn().mockRejectedValue(new Error('Too many attempts. Wait a minute and try again.'));
    const { user } = renderForgot(makeAuthValue({ sendResetEmail }));
    await user.type(screen.getByLabelText(/work email/i), 'alex.rivera@quantelis.lk');
    await user.click(screen.getByRole('button', { name: /send reset link/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/too many attempts/i);
    expect(screen.queryByText(/if that address has an account/i)).not.toBeInTheDocument();
  });
});

describe('ResetPasswordPage', () => {
  it('verifies the emailed link before offering the form', async () => {
    const { auth } = renderReset();
    await waitFor(() => expect(auth.verifyResetCode).toHaveBeenCalledWith('code-123'));
    expect(await screen.findByLabelText(/^new password$/i)).toBeInTheDocument();
    expect(screen.getByText(/alex\.rivera@quantelis\.lk/)).toBeInTheDocument();
  });

  it('reports a dead link and offers a new one instead of a form that cannot work', async () => {
    const verifyResetCode = vi.fn().mockRejectedValue(new Error('That reset link has expired or has already been used. Request a new one.'));
    renderReset(makeAuthValue({ verifyResetCode }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/has expired or has already been used/i);
    expect(screen.queryByLabelText(/^new password$/i)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /request a new link/i })).toHaveAttribute('href', '/forgot-password');
  });

  it('rejects a missing code without calling Firebase', async () => {
    const { auth } = renderReset(makeAuthValue(), '');
    expect(await screen.findByRole('alert')).toHaveTextContent(/missing its reset code/i);
    expect(auth.verifyResetCode).not.toHaveBeenCalled();
  });

  it('enforces the password rules and the confirmation match', async () => {
    const { user, auth } = renderReset();
    await screen.findByLabelText(/^new password$/i);

    await user.click(screen.getByRole('button', { name: /save new password/i }));
    expect(auth.confirmPasswordReset).not.toHaveBeenCalled();
    expect(await screen.findByText('Choose a password.')).toBeInTheDocument();

    await user.type(screen.getByLabelText(/^new password$/i), 'short');
    await user.type(screen.getByLabelText(/confirm new password/i), 'short1');
    await user.click(screen.getByRole('button', { name: /save new password/i }));
    expect(await screen.findByText(/at least 8 characters/i)).toBeInTheDocument();
    expect(auth.confirmPasswordReset).not.toHaveBeenCalled();
  });

  it('saves the new password and sends the user to sign in', async () => {
    const { user, auth } = renderReset();
    await screen.findByLabelText(/^new password$/i);

    await user.type(screen.getByLabelText(/^new password$/i), 'forecast2026');
    await user.type(screen.getByLabelText(/confirm new password/i), 'forecast2026');
    await user.click(screen.getByRole('button', { name: /save new password/i }));

    await waitFor(() => expect(auth.confirmPasswordReset).toHaveBeenCalledWith('code-123', 'forecast2026'));
    expect(await screen.findByText(/your password has been changed/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /go to sign in/i })).toHaveAttribute('href', '/login');
  });

  it('reports an expired code at submit time instead of claiming success', async () => {
    const confirmPasswordReset = vi.fn().mockRejectedValue(new Error('That reset link has expired or has already been used. Request a new one.'));
    const auth: AuthContextValue = makeAuthValue({ confirmPasswordReset });
    const { user } = renderReset(auth);
    await screen.findByLabelText(/^new password$/i);

    await user.type(screen.getByLabelText(/^new password$/i), 'forecast2026');
    await user.type(screen.getByLabelText(/confirm new password/i), 'forecast2026');
    await user.click(screen.getByRole('button', { name: /save new password/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/has expired or has already been used/i);
    expect(screen.queryByText(/your password has been changed/i)).not.toBeInTheDocument();
  });
});
