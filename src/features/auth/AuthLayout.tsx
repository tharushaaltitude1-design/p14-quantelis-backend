import type { ReactNode } from 'react';
import { Logo } from '@/components/brand/Logo';
import { COMPANY } from '@/config/constants';
import { LEGAL_LINKS } from './legalLinks';

/**
 * Split-screen shell shared by Sign in and Sign up.
 *
 * The form column reuses the dashboard's own tokens (`text-input`, `primary-button`,
 * `field-error`, `field-label`) so the auth screens match the product rather than looking
 * bolted on, and the marketing panel is decorative only.
 */
export function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer: ReactNode }) {
  return (
    <div className="auth-shell">
      <aside className="auth-aside" aria-hidden="true">
        <div className="auth-aside-glow" />
        <div className="auth-aside-body">
          {/* Real wordmark, linking to the marketing site in a new tab. Hidden below 1025px, where
              `.auth-card-logo` takes over, so the logo is never on screen twice at once.

              tabIndex={-1} because this sits inside the aria-hidden marketing panel: a control
              that assistive tech cannot announce must not sit in the tab order, or keyboard users
              land on a link with no accessible name. It stays mouse-clickable, and the equivalent
              link in the card head (shown on smaller screens) is the keyboard-reachable one. */}
          <a
            className="auth-aside-logo-link"
            href={COMPANY.siteUrl}
            target="_blank"
            rel="noopener noreferrer"
            tabIndex={-1}
            aria-hidden="true"
          >
            <Logo className="auth-aside-logo" alt="" />
          </a>
          <h2>Forecasting that keeps pace with your planning.</h2>
          <p>
            Quantelis turns raw operational data into validated forecasts, scenario comparisons and an
            auditable run history — so every decision ships with the evidence behind it.
          </p>
          <ul className="auth-aside-points">
            <li>Validated datasets with visible quality scores</li>
            <li>Side-by-side scenario comparison across projects</li>
            <li>Full run history you can export and audit</li>
          </ul>
        </div>
      </aside>

      <main className="auth-main">
        <div className="auth-card">
          <div className="auth-card-head">
            {/* Only shown once the marketing panel is hidden, so mobile still gets the brand.
                This is the keyboard-reachable copy of the link. */}
            <a
              className="auth-card-logo-link"
              href={COMPANY.siteUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Quantelis website (opens in a new tab)"
            >
              <Logo className="auth-card-logo" />
            </a>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          {children}
          <div className="auth-card-foot">{footer}</div>
        </div>
        <p className="auth-legal">
          {/* `rel="noopener noreferrer"` keeps the opened page from reaching back via window.opener. */}
          By continuing you agree to our{' '}
          <a href={LEGAL_LINKS.terms} target="_blank" rel="noopener noreferrer">
            Terms of Service
          </a>{' '}
          and{' '}
          <a href={LEGAL_LINKS.privacy} target="_blank" rel="noopener noreferrer">
            Privacy Policy
          </a>
          .
        </p>
      </main>
    </div>
  );
}

/** Small inline banner for form-level auth errors; announced politely to screen readers. */
export function AuthError({ message }: { message: string }) {
  if (!message) return null;
  return (
    <p className="auth-error" role="alert">
      {message}
    </p>
  );
}
