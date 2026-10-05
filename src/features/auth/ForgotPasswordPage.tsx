import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Loader2, Mail } from 'lucide-react';
import { useAuth } from '@/state/authContext';
import { ROUTES } from '@/config/constants';
import { AuthError, AuthLayout } from './AuthLayout';
import { hasErrors, validateSignIn, type FieldErrors } from './validation';

type LocationState = { email?: string };

/**
 * Step one of the password reset: collect the address and email a single-use link.
 *
 * This used to be a link that fired the request straight from the sign-in form, which left the
 * user on the same screen with no way to correct a typo'd address and no place for the link to
 * land. It is a page of its own now, and the emailed link returns to `/reset-password`.
 */
export function ForgotPasswordPage() {
  const { sendResetEmail, isDemoMode } = useAuth();
  const location = useLocation();
  // The sign-in screen hands over whatever was already typed, so a user who misspelled the
  // domain does not have to type the whole address again.
  const presetEmail = (location.state as LocationState | null)?.email ?? '';

  const [email, setEmail] = useState(presetEmail);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (presetEmail) setEmail(presetEmail);
  }, [presetEmail]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError('');
    setNotice('');

    // Only the address is needed here, so the password rules are not applied.
    const nextErrors = validateSignIn({ email, password: 'unused' });
    setErrors(nextErrors);
    if (hasErrors(nextErrors)) return;

    setPending(true);
    try {
      await sendResetEmail(email);
      // Deliberately neutral: revealing whether the address exists would turn this form into an
      // account-enumeration oracle.
      setNotice('If that address has an account, a password reset link is on its way. The link is valid for one hour.');
      setPending(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'We could not send that reset email. Please try again.');
      setPending(false);
    }
  };

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter the work email on your account and we will send you a link to choose a new password."
      footer={
        <>
          Remembered it? <Link to={ROUTES.login}>Back to sign in</Link>
        </>
      }
    >
      <form className="auth-form" onSubmit={onSubmit} noValidate>
        {isDemoMode && (
          <p className="auth-notice" role="status">
            Firebase is not configured, so this cannot send a real email. Add the <code>VITE_FIREBASE_*</code> values to enable it.
          </p>
        )}
        <AuthError message={formError} />
        {notice && (
          <p className="auth-success" role="status">
            {notice}
          </p>
        )}

        <div className="auth-field">
          <label className="field-label" htmlFor="forgot-email">
            Work email
          </label>
          <div className="auth-input-wrap">
            <Mail size={16} aria-hidden="true" />
            <input
              id="forgot-email"
              className="text-input"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? 'forgot-email-error' : undefined}
            />
          </div>
          {errors.email && (
            <span className="field-error" id="forgot-email-error">
              {errors.email}
            </span>
          )}
        </div>

        {notice ? (
          <button type="button" className="secondary-button auth-submit" onClick={() => setNotice('')}>
            Use a different email
          </button>
        ) : (
          <button type="submit" className="primary-button auth-submit" disabled={pending}>
            {pending ? (
              <>
                <Loader2 size={16} className="spin" /> Sending link…
              </>
            ) : (
              <>
                Send reset link <ArrowRight size={16} />
              </>
            )}
          </button>
        )}

        <Link className="auth-back-link" to={ROUTES.login}>
          <ArrowLeft size={14} /> Back to sign in
        </Link>
      </form>
    </AuthLayout>
  );
}
