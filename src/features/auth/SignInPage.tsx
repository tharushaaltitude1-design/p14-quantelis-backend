import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, Loader2, Lock, Mail } from 'lucide-react';
import { useAuth } from '@/state/authContext';
import { GUEST_ROUTES, ROUTES } from '@/config/constants';
import { rememberReturnTo } from '@/lib/authReturn';
import { safeReturnTo } from '@/lib/redirect';
import { AuthError, AuthLayout } from './AuthLayout';
import { AuthDivider, GoogleButton } from './GoogleButton';
import { hasErrors, validateSignIn, type FieldErrors } from './validation';

type LocationState = { from?: string };

export function SignInPage() {
  const { signIn, signInWithGoogle, redirectError, clearRedirectError, isDemoMode } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // `from` is untrusted: the guard writes it, but a crafted `state` or a future callback route
  // could put anything here, and `navigate()` honours absolute URLs. Sanitise before use, and
  // never treat a guest screen as a destination — signing in from a deep-linked /login would
  // otherwise send the user straight back to this form.
  const requestedTarget = safeReturnTo((location.state as LocationState | null)?.from, ROUTES.overview);
  const redirectTo = GUEST_ROUTES.includes(requestedTarget) ? ROUTES.overview : requestedTarget;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [pending, setPending] = useState(false);
  const [googlePending, setGooglePending] = useState(false);

  // A Google sign-in that came back through a redirect reloads the app, so this is the first
  // render that exists after the failure and the only place its message can be shown. Captured
  // once: clearing it on submit must not make the message reappear if the provider value changes.
  const [failedRedirect] = useState(redirectError ?? '');

  const onGoogle = async () => {
    setFormError('');
    clearRedirectError();
    setGooglePending(true);
    // Written before the call: if the popup is refused and this falls back to a full-page
    // redirect, the in-memory router state is gone by the time the user arrives back.
    rememberReturnTo(redirectTo);
    try {
      await signInWithGoogle();
      navigate(redirectTo, { replace: true });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Google sign-in did not complete. Please try again.');
      setGooglePending(false);
    }
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError('');
    clearRedirectError();

    const nextErrors = validateSignIn({ email, password });
    setErrors(nextErrors);
    if (hasErrors(nextErrors)) return;

    setPending(true);
    try {
      await signIn(email, password);
      navigate(redirectTo, { replace: true });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'We could not sign you in. Please try again.');
      setPending(false);
    }
  };

  return (
    <AuthLayout
      title="Sign in to Quantelis"
      subtitle="Use your work email to reach your forecasting workspace."
      footer={
        <>
          New to Quantelis? <Link to={ROUTES.signup}>Create an account</Link>
        </>
      }
    >
      <form className="auth-form" onSubmit={onSubmit} noValidate>
        {isDemoMode && (
          <p className="auth-notice" role="status">
            Firebase is not configured, so sign-in is bypassed. Add the <code>VITE_FIREBASE_*</code> values to enable it.
          </p>
        )}
        <AuthError message={formError || failedRedirect} />

        <GoogleButton label="Sign in with Google" pending={googlePending} onClick={() => void onGoogle()} />
        <AuthDivider />

        <div className="auth-field">
          <label className="field-label" htmlFor="signin-email">
            Work email
          </label>
          <div className="auth-input-wrap">
            <Mail size={16} aria-hidden="true" />
            <input
              id="signin-email"
              className="text-input"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? 'signin-email-error' : undefined}
            />
          </div>
          {errors.email && (
            <span className="field-error" id="signin-email-error">
              {errors.email}
            </span>
          )}
        </div>

        <div className="auth-field">
          <div className="auth-label-row">
            <label className="field-label" htmlFor="signin-password">
              Password
            </label>
            {/* A real link, not a button that fires the request in place: the reset needs its own
                screen, and a hand-off lets a typo'd address be corrected instead of sent. */}
            <Link className="text-button" to={ROUTES.forgotPassword} state={{ email }}>
              Forgot password?
            </Link>
          </div>
          <div className="auth-input-wrap">
            <Lock size={16} aria-hidden="true" />
            <input
              id="signin-password"
              className="text-input"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? 'signin-password-error' : undefined}
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
          {errors.password && (
            <span className="field-error" id="signin-password-error">
              {errors.password}
            </span>
          )}
        </div>

        <button type="submit" className="primary-button auth-submit" disabled={pending}>
          {pending ? (
            <>
              <Loader2 size={16} className="spin" /> Signing in…
            </>
          ) : (
            <>
              Sign in <ArrowRight size={16} />
            </>
          )}
        </button>
      </form>
    </AuthLayout>
  );
}
