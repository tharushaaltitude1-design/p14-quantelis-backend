import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Eye, EyeOff, Loader2, Lock } from 'lucide-react';
import { useAuth } from '@/state/authContext';
import { ROUTES } from '@/config/constants';
import { AuthError, AuthLayout } from './AuthLayout';
import { hasErrors, passwordStrength, validateSignUp, type FieldErrors } from './validation';

type Phase = 'checking' | 'ready' | 'failed' | 'done';

/**
 * Step two of the password reset: the target of the emailed link.
 *
 * Firebase hands the link over as `?oobCode=...`. The code is verified before the form is shown,
 * so an expired or already-used link is reported up front rather than after the user has typed a
 * new password. Submitting consumes the code, which is what makes it single-use.
 */
export function ResetPasswordPage() {
  const { verifyResetCode, confirmPasswordReset, isDemoMode } = useAuth();
  const [params] = useSearchParams();
  const oobCode = params.get('oobCode') ?? '';

  const [phase, setPhase] = useState<Phase>(oobCode ? 'checking' : 'failed');
  const [checkError, setCheckError] = useState(oobCode ? '' : 'That link is missing its reset code.');
  const [accountEmail, setAccountEmail] = useState('');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [pending, setPending] = useState(false);

  const strength = passwordStrength(password);
  // Guards against a second verification pass when React re-runs the effect in development.
  const checkedCode = useRef<string | null>(null);

  useEffect(() => {
    if (!oobCode || checkedCode.current === oobCode) return;
    checkedCode.current = oobCode;
    let active = true;
    verifyResetCode(oobCode).then(
      (email) => {
        if (!active) return;
        setAccountEmail(email);
        setPhase('ready');
      },
      (error: unknown) => {
        if (!active) return;
        setCheckError(error instanceof Error ? error.message : 'That reset link is no longer valid.');
        setPhase('failed');
      },
    );
    return () => {
      active = false;
    };
  }, [oobCode, verifyResetCode]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError('');

    const nextErrors = validateSignUp({ fullName: 'placeholder', email: 'placeholder@example.com', password, confirmPassword });
    setErrors({ password: nextErrors.password, confirmPassword: nextErrors.confirmPassword });
    if (hasErrors(nextErrors)) return;

    setPending(true);
    try {
      await confirmPasswordReset(oobCode, password);
      setPhase('done');
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'We could not set that new password. Please try again.');
      setPending(false);
    }
  };

  const footer = (
    <>
      Remembered it? <Link to={ROUTES.login}>Back to sign in</Link>
    </>
  );

  if (phase === 'checking') {
    return (
      <AuthLayout title="Reset your password" subtitle="Checking your reset link…" footer={footer}>
        <p className="auth-notice" role="status">
          <Loader2 size={14} className="spin" /> Verifying the link from your email.
        </p>
      </AuthLayout>
    );
  }

  if (phase === 'failed') {
    return (
      <AuthLayout title="Reset your password" subtitle="This link can no longer be used." footer={footer}>
        <AuthError message={checkError} />
        <Link className="primary-button auth-submit" to={ROUTES.forgotPassword}>
          Request a new link <ArrowRight size={16} />
        </Link>
        <Link className="auth-back-link" to={ROUTES.login}>
          Back to sign in
        </Link>
      </AuthLayout>
    );
  }

  if (phase === 'done') {
    return (
      <AuthLayout title="Password updated" subtitle="You can sign in with your new password now." footer={footer}>
        <p className="auth-success" role="status">
          <CheckCircle2 size={14} /> Your password has been changed.
        </p>
        <Link className="primary-button auth-submit" to={ROUTES.login}>
          Go to sign in <ArrowRight size={16} />
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Choose a new password"
      subtitle={accountEmail ? `You are resetting the password for ${accountEmail}.` : 'Pick something you have not used before.'}
      footer={footer}
    >
      <form className="auth-form" onSubmit={onSubmit} noValidate>
        {isDemoMode && (
          <p className="auth-notice" role="status">
            Firebase is not configured, so this cannot verify a real link. Add the <code>VITE_FIREBASE_*</code> values to enable it.
          </p>
        )}
        <AuthError message={formError} />

        <div className="auth-field">
          <label className="field-label" htmlFor="reset-password">
            New password
          </label>
          <div className="auth-input-wrap">
            <Lock size={16} aria-hidden="true" />
            <input
              id="reset-password"
              className="text-input"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-invalid={Boolean(errors.password)}
              aria-describedby="reset-password-hint"
            />
            <button
              type="button"
              className="auth-reveal"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {password && (
            <div className="auth-strength" aria-live="polite">
              <div className="auth-strength-bars">
                {[1, 2, 3, 4].map((step) => (
                  <span key={step} className={step <= strength.score ? `is-on tone-${strength.score}` : undefined} />
                ))}
              </div>
              <span className="auth-strength-label">{strength.label}</span>
            </div>
          )}
          <span className="auth-hint" id="reset-password-hint">
            Use 8 or more characters with a mix of letters and numbers.
          </span>
          {errors.password && <span className="field-error">{errors.password}</span>}
        </div>

        <div className="auth-field">
          <label className="field-label" htmlFor="reset-confirm">
            Confirm new password
          </label>
          <div className="auth-input-wrap">
            <Lock size={16} aria-hidden="true" />
            <input
              id="reset-confirm"
              className="text-input"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Repeat your new password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              aria-invalid={Boolean(errors.confirmPassword)}
              aria-describedby={errors.confirmPassword ? 'reset-confirm-error' : undefined}
            />
          </div>
          {errors.confirmPassword && (
            <span className="field-error" id="reset-confirm-error">
              {errors.confirmPassword}
            </span>
          )}
        </div>

        <button type="submit" className="primary-button auth-submit" disabled={pending}>
          {pending ? (
            <>
              <Loader2 size={16} className="spin" /> Saving…
            </>
          ) : (
            <>
              Save new password <ArrowRight size={16} />
            </>
          )}
        </button>
      </form>
    </AuthLayout>
  );
}
