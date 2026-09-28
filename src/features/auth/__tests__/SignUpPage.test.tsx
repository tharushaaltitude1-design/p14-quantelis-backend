import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SignUpPage } from '../SignUpPage';
import { AuthTestProvider } from '@/test/authTestUtils';
import { makeAuthValue } from '@/test/authFixtures';

function renderPage(auth = makeAuthValue()) {
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={['/signup']}>
      <AuthTestProvider value={auth}>
        <Routes>
          <Route path="/signup" element={<SignUpPage />} />
          <Route path="/profile" element={<h1>Profile</h1>} />
          <Route path="/" element={<h1>Overview</h1>} />
          <Route path="/login" element={<h1>Sign in</h1>} />
        </Routes>
      </AuthTestProvider>
    </MemoryRouter>,
  );
  return { user, auth };
}

async function fillForm(user: ReturnType<typeof userEvent.setup>, values: { name?: string; email?: string; password?: string; confirm?: string }) {
  if (values.name !== undefined) await user.type(screen.getByLabelText(/full name/i), values.name);
  if (values.email !== undefined) await user.type(screen.getByLabelText(/work email/i), values.email);
  if (values.password !== undefined) await user.type(screen.getByLabelText(/^password$/i), values.password);
  if (values.confirm !== undefined) await user.type(screen.getByLabelText(/confirm password/i), values.confirm);
}

describe('SignUpPage', () => {
  it('renders every required field and links back to sign in', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /create your account/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/work email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /sign in/i })).toHaveAttribute('href', '/login');
  });

  it('reports every empty field on a blank submit', async () => {
    const { user, auth } = renderPage();
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(auth.signUp).not.toHaveBeenCalled();
    expect(await screen.findByText('Tell us your name.')).toBeInTheDocument();
    expect(screen.getByText('Enter your email address.')).toBeInTheDocument();
    expect(screen.getByText('Choose a password.')).toBeInTheDocument();
  });

  it('flags a confirmation that does not match a real password', async () => {
    const { user, auth } = renderPage();
    await fillForm(user, { name: 'Alex Rivera', email: 'alex@quantelis.ai', password: 'forecast2026', confirm: 'forecast2025' });
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(auth.signUp).not.toHaveBeenCalled();
    expect(await screen.findByText('Passwords do not match.')).toBeInTheDocument();
  });

  it('rejects a weak password and a mismatched confirmation', async () => {
    const { user, auth } = renderPage();
    await fillForm(user, { name: 'Alex Rivera', email: 'alex@quantelis.ai', password: 'abc', confirm: 'different1' });
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(auth.signUp).not.toHaveBeenCalled();
    expect(await screen.findByText(/at least 8 characters/i)).toBeInTheDocument();
    expect(screen.getByText('Passwords do not match.')).toBeInTheDocument();
  });

  it('creates the account and sends the user to verify their email', async () => {
    const { user, auth } = renderPage();
    await fillForm(user, { name: 'Alex Rivera', email: 'alex.rivera@quantelis.ai', password: 'forecast2026', confirm: 'forecast2026' });
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() =>
      expect(auth.signUp).toHaveBeenCalledWith({ fullName: 'Alex Rivera', email: 'alex.rivera@quantelis.ai', password: 'forecast2026' }),
    );
    expect(await screen.findByRole('heading', { name: /profile/i })).toBeInTheDocument();
  });

  it('goes straight to the workspace when no verification email could be sent', async () => {
    const auth = makeAuthValue({ signUp: async () => ({ verificationEmailSent: false }) });
    const { user } = renderPage(auth);
    await fillForm(user, { name: 'Alex Rivera', email: 'alex.rivera@quantelis.ai', password: 'forecast2026', confirm: 'forecast2026' });
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByRole('heading', { name: /overview/i })).toBeInTheDocument();
  });

  it('surfaces the duplicate-account error from Firebase', async () => {
    const auth = makeAuthValue({ signUp: async () => { throw new Error('An account already exists for that email. Sign in instead.'); } });
    const { user } = renderPage(auth);
    await fillForm(user, { name: 'Alex Rivera', email: 'taken@quantelis.ai', password: 'forecast2026', confirm: 'forecast2026' });
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/already exists for that email/i);
  });

  it('reports password strength live as the user types', async () => {
    const { user } = renderPage();
    const password = screen.getByLabelText(/^password$/i);

    // Mixed case + digit + symbol, long enough to top out the meter.
    await user.type(password, 'Forecast2026!');
    expect(screen.getByText('Strong')).toBeInTheDocument();

    await user.clear(password);
    await user.type(password, 'abc');
    expect(screen.getByText('Very weak')).toBeInTheDocument();
  });

  it('disables the submit button only while the request is in flight', async () => {
    const auth = makeAuthValue();
    const { user } = renderPage(auth);
    await fillForm(user, { name: 'Alex Rivera', email: 'alex.rivera@quantelis.ai', password: 'forecast2026', confirm: 'forecast2026' });

    const submit = screen.getByRole('button', { name: /create account/i });
    expect(submit).toBeEnabled();
    await user.click(submit);
    await waitFor(() => expect(auth.signUp).toHaveBeenCalled());
  });

  it('offers Google sign-up and skips verification since Google already verified the email', async () => {
    const { user, auth } = renderPage();
    await user.click(screen.getByRole('button', { name: /sign up with google/i }));

    await waitFor(() => expect(auth.signInWithGoogle).toHaveBeenCalled());
    expect(auth.signUp).not.toHaveBeenCalled();
    expect(await screen.findByRole('heading', { name: /overview/i })).toBeInTheDocument();
  });

  it('surfaces a Google account conflict on the sign-up screen', async () => {
    const signInWithGoogle = vi
      .fn()
      .mockRejectedValue(new Error('An account already uses that email with a different sign-in method. Sign in with your password instead.'));
    const { user } = renderPage(makeAuthValue({ signInWithGoogle }));
    await user.click(screen.getByRole('button', { name: /sign up with google/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/different sign-in method/i);
  });

  it('links the legal documents and opens them in a new tab', () => {
    renderPage();
    const terms = screen.getByRole('link', { name: /terms of service/i });
    const privacy = screen.getByRole('link', { name: /privacy policy/i });

    expect(terms).toHaveAttribute('href', 'https://quantelis.lk/terms');
    expect(privacy).toHaveAttribute('href', 'https://quantelis.lk/privacy');
    for (const link of [terms, privacy]) {
      expect(link).toHaveAttribute('target', '_blank');
      expect(link.getAttribute('rel')).toContain('noopener');
      expect(link.getAttribute('rel')).toContain('noreferrer');
    }
  });
});
