import { Loader2 } from 'lucide-react';

/**
 * The official four-colour Google "G" (viewBox 18×18), matching the branding required by
 * Google's sign-in button guidelines. Inlined rather than pulled from a CDN so the button
 * never renders late or leaks a request to a third party.
 */
function GoogleMark() {
  return (
    <svg className="google-mark" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91c1.71-1.57 2.69-3.88 2.69-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.81.54-1.84.86-3.05.86-2.35 0-4.34-1.58-5.05-3.71H.96v2.34A9 9 0 0 0 9 18Z"
      />
      <path fill="#FBBC05" d="M3.95 10.71a5.4 5.4 0 0 1 0-3.42V4.95H.96a9 9 0 0 0 0 8.1l2.99-2.34Z" />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l2.99 2.34C4.66 5.16 6.65 3.58 9 3.58Z"
      />
    </svg>
  );
}

type GoogleButtonProps = {
  /** e.g. "Sign in with Google" / "Sign up with Google", per Google's button wording guidance. */
  label: string;
  pending: boolean;
  onClick: () => void;
};

export function GoogleButton({ label, pending, onClick }: GoogleButtonProps) {
  return (
    <button type="button" className="auth-google" onClick={onClick} disabled={pending}>
      {pending ? <Loader2 size={16} className="spin" aria-hidden="true" /> : <GoogleMark />}
      {pending ? 'Connecting to Google…' : label}
    </button>
  );
}

/** Rule between the federated option and the email form. */
export function AuthDivider({ children = 'or continue with email' }: { children?: string }) {
  return (
    <div className="auth-divider" role="separator" aria-label={children}>
      <span>{children}</span>
    </div>
  );
}
