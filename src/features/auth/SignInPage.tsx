import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, Loader2, Lock, Mail } from 'lucide-react';
import { useAuth } from '@/state/authContext';
import { ROUTES } from '@/config/constants';
import { AuthError, AuthLayout } from './AuthLayout';
import { hasErrors, validateSignIn, type FieldErrors } from './validation';

type LocationState = { from?: string };

export function SignInPage() {
  const { signIn, sendResetEmail, isDemoMode } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = (location.state as LocationState | null)?.from ?? ROUTES.overview;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, setPending] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError('');
    setNotice('');

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

  const onForgotPassword = async () => {
    setFormError('');
    setNotice('');
    const emailError = validateSignIn({ email, password: 'placeholder' }).email;
    if (emailError) {
      setErrors((current) => ({ ...current, email: emailError }));
      return;
    }
    setPending(true);
    try {
      await sendResetEmail(email);
      setNotice('If that address has an account, a password reset link is on its way.');
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'We could not send that reset email.');
    } finally {
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
        <AuthError message={formError} />
        {notice && (
          <p className="auth-success" role="status">
            {notice}
          </p>
        )}

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
            <button type="button" className="text-button" onClick={onForgotPassword} disabled={pending}>
              Forgot password?
            </button>
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
