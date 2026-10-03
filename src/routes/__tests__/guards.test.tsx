import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { RedirectIfAuthenticated, RequireAuth } from '../guards';
import { WorkspaceProvider } from '@/state/WorkspaceProvider';
import { AuthTestProvider } from '@/test/authTestUtils';
import { makeAuthValue } from '@/test/authFixtures';

// `RequireAuth` reads `hydrated` off the workspace store, so the real composition (auth outside,
// workspace inside) is what these tests render.
const renderWith = (status: 'loading' | 'authenticated' | 'unauthenticated', initialEntry: string) =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <AuthTestProvider value={makeAuthValue({ status })}>
        <WorkspaceProvider>
          <Routes>
            <Route path="/login" element={<h1>Sign in screen</h1>} />
            <Route
              path="/*"
              element={
                <RequireAuth>
                  <h1>Protected dashboard</h1>
                </RequireAuth>
              }
            />
          </Routes>
        </WorkspaceProvider>
      </AuthTestProvider>
    </MemoryRouter>,
  );

describe('RequireAuth', () => {
  it('waits instead of redirecting while the session is still loading', () => {
    const { container } = renderWith('loading', '/datasets');
    // A refresh must not bounce a signed-in user to /login for a frame, so the guard shows the
    // loading skeleton (aria-busy) rather than redirecting.
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(screen.queryByText(/sign in screen/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/protected dashboard/i)).not.toBeInTheDocument();
  });

  it('sends an unauthenticated visitor to the sign-in screen', () => {
    renderWith('unauthenticated', '/datasets');
    expect(screen.getByRole('heading', { name: /sign in screen/i })).toBeInTheDocument();
  });

  it('lets a signed-in user through to the protected route', () => {
    renderWith('authenticated', '/datasets');
    expect(screen.getByRole('heading', { name: /protected dashboard/i })).toBeInTheDocument();
  });
});

describe('RedirectIfAuthenticated', () => {
  const renderAuth = (status: 'loading' | 'authenticated' | 'unauthenticated') =>
    render(
      <MemoryRouter initialEntries={['/login']}>
        <AuthTestProvider value={makeAuthValue({ status })}>
          <Routes>
            <Route
              path="/login"
              element={
                <RedirectIfAuthenticated>
                  <h1>Sign in screen</h1>
                </RedirectIfAuthenticated>
              }
            />
            <Route path="/" element={<h1>Overview</h1>} />
          </Routes>
        </AuthTestProvider>
      </MemoryRouter>,
    );

  it('keeps a signed-in user out of the sign-in screen', () => {
    renderAuth('authenticated');
    expect(screen.getByRole('heading', { name: /overview/i })).toBeInTheDocument();
  });

  it('shows the sign-in screen to a visitor who is not signed in', () => {
    renderAuth('unauthenticated');
    expect(screen.getByRole('heading', { name: /sign in screen/i })).toBeInTheDocument();
  });
});
