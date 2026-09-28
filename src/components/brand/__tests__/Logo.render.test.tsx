import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthLayout } from '@/features/auth/AuthLayout';
import { SignInPage } from '@/features/auth/SignInPage';
import { SignUpPage } from '@/features/auth/SignUpPage';
import { AuthTestProvider } from '@/test/authTestUtils';
import { makeAuthValue } from '@/test/authFixtures';

const withRouter = (ui: React.ReactNode) =>
  render(
    <MemoryRouter initialEntries={['/login']}>
      <AuthTestProvider value={makeAuthValue()}>
        <Routes>
          <Route path="/login" element={ui} />
        </Routes>
      </AuthTestProvider>
    </MemoryRouter>,
  );

/** The rendered <img> for the wordmark, or null when it is absent. */
const wordmark = () => screen.queryByAltText('Quantelis');

describe('wordmark renders in the DOM', () => {
  it('renders on the sign-in screen', () => {
    withRouter(<SignInPage />);
    const img = wordmark();
    expect(img).toBeInTheDocument();
    // Resolved from the import of src/assets/logo.png. Vite serves it un-hashed in dev/test and
    // rewrites it to a hashed /assets/logo-<hash>.png in a production build.
    expect(img?.getAttribute('src')).toMatch(/logo[\w-]*\.png$/);
  });

  it('renders on the sign-up screen', () => {
    withRouter(<SignUpPage />);
    expect(wordmark()).toBeInTheDocument();
  });

  it('carries the intrinsic size so the layout does not shift before the image loads', () => {
    withRouter(<SignInPage />);
    expect(wordmark()).toHaveAttribute('width', '1500');
    expect(wordmark()).toHaveAttribute('height', '500');
  });

  it('is exposed as a plain image, not announced twice by the decorative aside copy', () => {
    withRouter(
      <AuthLayout title="Sign in" subtitle="sub" footer={null}>
        <p>form</p>
      </AuthLayout>,
    );
    // One image with a real alt in the card; the aside copy is aria-hidden, so assistive tech
    // reads the brand exactly once.
    expect(screen.getAllByAltText('Quantelis')).toHaveLength(1);
    expect(screen.getByAltText('')).toHaveClass('auth-aside-logo');
  });
});
