import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Eye, EyeOff, Loader2, Lock } from 'lucide-react';
import { useAuth } from '@/state/authContext';
import { ROUTES } from '@/config/constants';
import { forgetResetCode, loadResetCode, rememberResetCode, resetCodeFromLocation } from '@/lib/resetCode';
import { AuthError, AuthLayout } from './AuthLayout';
import { hasErrors, passwordStrength, validateSignUp, type FieldErrors } from './validation';

type Phase = 'checking' | 'ready' | 'failed' | 'done';

/** The fragment a link can hide its parameters behind; read outside the router, which cannot see it. */
function currentHash(): string {
  return typeof window === 'undefined' ? '' : window.location.hash;
}

/**
 * Step two of the password reset: the target of the emailed link.
 *
 * Firebase hands the link over as `?oobCode=...`. The code is verified before the form is shown,
 * so an expired or already-used link is reported up front rather than after the user has typed a
 * new password. Submitting consumes the code, which is what makes it single-use.
 *
 * The code is treated as something the tab owns rather than something the URL owns. A reset link
 * regularly arrives in a brand-new tab and is then reloaded, restored from history, or handed a
 * query string that a mail client or a link scanner has already stripped; relying on the URL alone
 * meant all of those ended on "That link is missing its reset code" with a perfectly good email
 * sitting in the inbox. So the tab keeps a copy, and once the code is spent the copy is dropped so
 * nothing can retry it.
 */
export function ResetPasswordPage() {
  const { verifyResetCode, confirmPasswordReset, isDemoMode } = useAuth();
  const [params, setParams] = useSearchParams();

  const { code: linkedCode, fromFragment } = resetCodeFromLocation(params.toString(), currentHash());
  const oobCode = linkedCode || loadResetCode();

  const [phase, setPhase] = useState<Phase>(oobCode ? 'checking' : 'failed');
  const [checkError, setCheckError] = useState(
    oobCode ? '' : 'That link is missing its reset code. Open the link straight from your email, or request a new one below.',
  );
  const [accountEmail, setAccountEmail] = useState('');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [pending, setPending] = useState(false);

  const strength = passwordStrength(password);

  // A link that hid its parameters in the fragment still works, but the address bar should carry
  // the code in the query string so the URL can be copied, bookmarked or reloaded.
  useEffect(() => {
    if (!fromFragment) return;
    setParams({ oobCode }, { replace: true });
  }, [fromFragment, oobCode, setParams]);

  useEffect(() => {
    if (!oobCode) return;
    rememberResetCode(oobCode);

    let active = true;
    // Deliberately not guarded by a "have I already checked this?" ref. Verifying does not consume
    // the code, so running it again is harmless — whereas skipping the second run left the first
    // run's result discarded by its own cleanup and the page stuck on "Checking your reset link…"
    // for good, which is exactly what React's development double-invoke does to an effect.
    verifyResetCode(oobCode).then(
      (email) => {
        if (!active) return;
        setAccountEmail(email);
        setPhase('ready');
      },
      (error: unknown) => {
        if (!active) return;
        // The code is dead, so the tab stops offering it: a later visit to `/reset-password` must
        // ask for a new link rather than re-present a link Firebase has already refused.
        forgetResetCode();
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
      // The code dies with this call, so the tab's copy of it has to die with it.
      forgetResetCode();
      setPhase('done');
    } catch (error) {
      forgetResetCode();
      setFormError(error instanceof Error ? error.message : 'We could not set that new password. Please try again.');
      setPending(false);
    }
  };

  const footer = (
    <>
      Remembered it?{' '}
      {/* Once the password is set the link is dead, so signing in replaces it: Back must not walk
          the user straight back onto a reset screen that can never work again. */}
      <Link to={ROUTES.login} replace={phase === 'done'}>
        Back to sign in
      </Link>
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
    // Two dead ends used to read identically: a link Firebase refused, and a link that never carried
    // a code at all. Telling someone whose mail client truncated the URL that "this link can no
    // longer be used" sends them hunting for an expired email that is still perfectly good.
    const missingCode = !oobCode;
    return (
      <AuthLayout
        title="Reset your password"
        subtitle={missingCode ? 'We could not read a reset code from this link.' : 'This link can no longer be used.'}
        footer={footer}
      >
        <AuthError message={checkError} />
        <Link className="primary-button auth-submit" to={ROUTES.forgotPassword} replace>
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
        <Link className="primary-button auth-submit" to={ROUTES.login} replace>
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
