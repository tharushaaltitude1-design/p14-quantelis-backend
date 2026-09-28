import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, Loader2, Lock, Mail, User as UserIcon } from 'lucide-react';
import { useAuth } from '@/state/authContext';
import { ROUTES } from '@/config/constants';
import { AuthError, AuthLayout } from './AuthLayout';
import { AuthDivider, GoogleButton } from './GoogleButton';
import { hasErrors, passwordStrength, validateSignUp, type FieldErrors } from './validation';

export function SignUpPage() {
  const { signUp, signInWithGoogle, isDemoMode } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [pending, setPending] = useState(false);
  const [googlePending, setGooglePending] = useState(false);

  const strength = passwordStrength(password);

  const onGoogle = async () => {
    setFormError('');
    setGooglePending(true);
    try {
      await signInWithGoogle();
      // A Google account arrives already verified, so it can go straight to the workspace.
      navigate(ROUTES.overview, { replace: true });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Google sign-up did not complete. Please try again.');
      setGooglePending(false);
    }
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError('');

    const nextErrors = validateSignUp({ fullName, email, password, confirmPassword });
    setErrors(nextErrors);
    if (hasErrors(nextErrors)) return;

    setPending(true);
    try {
      const { verificationEmailSent } = await signUp({ fullName, email, password });
      // `onAuthStateChanged` has usually already signed the user in, so the guard on `/` will
      // let them straight through. Verification is a follow-up, not a blocker.
      if (verificationEmailSent) {
        navigate(ROUTES.profile, { replace: true, state: { verifyEmail: true } });
      } else {
        navigate(ROUTES.overview, { replace: true });
      }
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'We could not create your account. Please try again.');
      setPending(false);
    }
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Start forecasting in minutes — no card, no sales call."
      footer={
        <>
          Already have an account? <Link to={ROUTES.login}>Sign in</Link>
        </>
      }
    >
      <form className="auth-form" onSubmit={onSubmit} noValidate>
        {isDemoMode && (
          <p className="auth-notice" role="status">
            Firebase is not configured, so sign-up is bypassed. Add the <code>VITE_FIREBASE_*</code> values to enable it.
          </p>
        )}
        <AuthError message={formError} />

        <GoogleButton label="Sign up with Google" pending={googlePending} onClick={() => void onGoogle()} />
        <AuthDivider children="or sign up with email" />

        <div className="auth-field">
          <label className="field-label" htmlFor="signup-name">
            Full name
          </label>
          <div className="auth-input-wrap">
            <UserIcon size={16} aria-hidden="true" />
            <input
              id="signup-name"
              className="text-input"
              type="text"
              autoComplete="name"
              placeholder="Alex Rivera"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              aria-invalid={Boolean(errors.fullName)}
              aria-describedby={errors.fullName ? 'signup-name-error' : undefined}
            />
          </div>
          {errors.fullName && (
            <span className="field-error" id="signup-name-error">
              {errors.fullName}
            </span>
          )}
        </div>

        <div className="auth-field">
          <label className="field-label" htmlFor="signup-email">
            Work email
          </label>
          <div className="auth-input-wrap">
            <Mail size={16} aria-hidden="true" />
            <input
              id="signup-email"
              className="text-input"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? 'signup-email-error' : undefined}
            />
          </div>
          {errors.email && (
            <span className="field-error" id="signup-email-error">
              {errors.email}
            </span>
          )}
        </div>

        <div className="auth-field">
          <label className="field-label" htmlFor="signup-password">
            Password
          </label>
          <div className="auth-input-wrap">
            <Lock size={16} aria-hidden="true" />
            <input
              id="signup-password"
              className="text-input"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-invalid={Boolean(errors.password)}
              aria-describedby="signup-password-hint"
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
          <span className="auth-hint" id="signup-password-hint">
            Use 8 or more characters with a mix of letters and numbers.
          </span>
          {errors.password && <span className="field-error">{errors.password}</span>}
        </div>

        <div className="auth-field">
          <label className="field-label" htmlFor="signup-confirm">
            Confirm password
          </label>
          <div className="auth-input-wrap">
            <Lock size={16} aria-hidden="true" />
            <input
              id="signup-confirm"
              className="text-input"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Repeat your password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              aria-invalid={Boolean(errors.confirmPassword)}
              aria-describedby={errors.confirmPassword ? 'signup-confirm-error' : undefined}
            />
          </div>
          {errors.confirmPassword && (
            <span className="field-error" id="signup-confirm-error">
              {errors.confirmPassword}
            </span>
          )}
        </div>

        <button type="submit" className="primary-button auth-submit" disabled={pending}>
          {pending ? (
            <>
              <Loader2 size={16} className="spin" /> Creating account…
            </>
          ) : (
            <>
              Create account <ArrowRight size={16} />
            </>
          )}
        </button>

        <p className="auth-fineprint">
          We verify new accounts by email so nobody can join your workspace uninvited.
        </p>
      </form>
    </AuthLayout>
  );
}
