import { useEffect, useRef, useState } from 'react';
import { Camera, CheckCircle2, ShieldCheck, X } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { Select } from '@/components/ui/Select';
import { initialsFor } from '@/lib/initials';
import { JOB_ROLES } from '@/data/mock';
import { useWorkspace, useWorkspaceDispatch } from '@/state/workspaceContext';
import { useAuth } from '@/state/authContext';
import { deleteProfilePhoto, uploadProfilePhoto, validatePhoto } from '@/lib/profileStorage';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ProfilePage() {
  const { profile, settings } = useWorkspace();
  const dispatch = useWorkspaceDispatch();
  const { user, updateProfile, isDemoMode, profileVersion } = useAuth();
  const isRemote = Boolean(user) && !isDemoMode;

  const [fullName, setFullName] = useState(profile.fullName);
  const [email, setEmail] = useState(profile.email);
  const [jobRole, setJobRole] = useState(profile.jobRole);
  const [department, setDepartment] = useState(profile.department);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState('');
  const [photoPending, setPhotoPending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Re-hydrate from the signed-in account whenever it changes (sign-in, or a profile write).
  // `profileVersion` is in the deps because updating the account keeps the same `user` object
  // identity, so depending on `user` alone would leave this stale after a save.
  useEffect(() => {
    if (!user) return;
    if (user.displayName) setFullName(user.displayName);
    if (user.email) setEmail(user.email);
    // `?? null` is load-bearing: a removed photo must clear the preview, not keep the old URL.
    setPhoto(user.photoURL ?? null);
  }, [user, profileVersion]);

  const dirty = fullName !== profile.fullName || jobRole !== profile.jobRole || department !== profile.department;
  const avatarSrc = photo ?? user?.photoURL ?? null;

  const save = async () => {
    const found: Record<string, string> = {};
    if (fullName.trim().length < 2) found.fullName = 'Enter your full name.';
    if (!EMAIL_PATTERN.test(email.trim())) found.email = 'Enter a valid work email address.';
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    try {
      // Display name and photo live on the Firebase account; role and department are
      // workspace-only fields with no Firebase equivalent, so they stay in the store.
      if (isRemote && fullName.trim() !== user?.displayName) {
        await updateProfile({ displayName: fullName.trim() });
      }
      // `photoURL` is included so the shell updates in demo mode too, where there is no
      // Firebase account to read the photo back from.
      dispatch({
        type: 'profile/update',
        changes: { fullName: fullName.trim(), email: email.trim(), jobRole, department, photoURL: avatarSrc },
      });
      dispatch({
        type: 'toast/push',
        toast: {
          kind: 'success',
          title: 'Profile saved',
          message: isRemote ? 'Your account and workspace details are up to date.' : 'Your workspace teammates see the updated details.',
        },
      });
    } catch (error) {
      dispatch({
        type: 'toast/push',
        toast: { kind: 'danger', title: 'Could not save profile', message: error instanceof Error ? error.message : 'Please try again.' },
      });
    } finally {
      setSaving(false);
    }
  };

  const pickPhoto = async (file: File | undefined) => {
    setPhotoError('');
    if (!file) return;
    const invalid = validatePhoto(file);
    if (invalid) {
      setPhotoError(invalid);
      return;
    }
    if (!isRemote) {
      // No Firebase: read locally so the control still previews, and say so plainly.
      const reader = new FileReader();
      reader.onload = () => setPhoto(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => setPhotoError('That file could not be read. Try a different image.');
      reader.readAsDataURL(file);
      return;
    }
    setPhotoPending(true);
    try {
      const url = await uploadProfilePhoto(file);
      setPhoto(url);
      await updateProfile({ photoURL: url });
      dispatch({ type: 'toast/push', toast: { kind: 'success', title: 'Photo updated', message: 'Your new avatar is live across the workspace.' } });
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : 'The upload failed. Please try again.');
    } finally {
      setPhotoPending(false);
    }
  };

  const clearPhoto = async () => {
    const previous = avatarSrc;
    setPhoto(null);
    setPhotoError('');
    if (!isRemote) return;
    try {
      await updateProfile({ photoURL: '' });
      if (previous) await deleteProfilePhoto(previous);
    } catch (error) {
      setPhoto(previous);
      setPhotoError(error instanceof Error ? error.message : 'We could not clear that photo.');
    }
  };

  return (
    <div className="page-stack profile-layout">
      <Card className="profile-hero">
        <Avatar
          name={fullName}
          initials={initialsFor(fullName)}
          src={avatarSrc}
          size="large"
          alt={`${fullName} profile photo`}
        />
        <div>
          <span className="eyebrow">PERSONAL PROFILE</span>
          <h2>{fullName}</h2>
          <p>
            {jobRole} · {settings.name}
          </p>
        </div>
        <div className="button-row">
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="visually-hidden"
            aria-label="Upload a profile photo"
            onChange={(event) => {
              void pickPhoto(event.target.files?.[0]);
              event.target.value = '';
            }}
          />
          <button type="button" className="secondary-button" onClick={() => fileRef.current?.click()} disabled={photoPending}>
            <Camera size={16} /> {photoPending ? 'Uploading…' : 'Upload photo'}
          </button>
          {avatarSrc && (
            <button type="button" className="icon-button" aria-label="Remove profile photo" onClick={() => void clearPhoto()} disabled={photoPending}>
              <X size={16} />
            </button>
          )}
        </div>
        {photoError && (
          <p className="field-error" role="alert">
            {photoError}
          </p>
        )}
        {!photoError && photo && !isRemote && (
          <p className="compare-note" role="status">
            Photo preview only — Firebase is not configured, so nothing is stored.
          </p>
        )}
        {isRemote && user?.emailVerified === false && (
          <p className="compare-note" role="status">
            Your email address is not verified yet. Check your inbox for the verification link.
          </p>
        )}
      </Card>

      <Card>
        <CardHeader title="Personal details" meta="Visible to your workspace members" />
        <div className="settings-form profile-form">
          <label className="field-label" htmlFor="pf-name">
            Full name
          </label>
          <input
            id="pf-name"
            className="text-input"
            value={fullName}
            aria-invalid={errors.fullName ? true : undefined}
            onChange={(event) => {
              setFullName(event.target.value);
              setErrors((e) => ({ ...e, fullName: '' }));
            }}
          />
          {errors.fullName && (
            <span className="field-error" role="alert">
              {errors.fullName}
            </span>
          )}
          <label className="field-label" htmlFor="pf-email">
            Work email
          </label>
          <input
            id="pf-email"
            className="text-input"
            type="email"
            value={email}
            readOnly={isRemote}
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={isRemote ? 'pf-email-hint' : undefined}
            onChange={(event) => {
              setEmail(event.target.value);
              setErrors((e) => ({ ...e, email: '' }));
            }}
          />
          {isRemote && (
            <span className="auth-hint" id="pf-email-hint">
              <ShieldCheck size={12} aria-hidden="true" /> This is your sign-in address. Changing it requires re-authentication, so it is
              managed from your account provider.
            </span>
          )}
          {errors.email && (
            <span className="field-error" role="alert">
              {errors.email}
            </span>
          )}
          {isRemote && user?.emailVerified && (
            <span className="auth-hint">
              <CheckCircle2 size={12} aria-hidden="true" /> Email verified
            </span>
          )}
          <label className="field-label" htmlFor="pf-role">
            Job role
          </label>
          <Select id="pf-role" value={jobRole} onChange={setJobRole} options={JOB_ROLES} label="Job role" className="settings-select" />
          <label className="field-label" htmlFor="pf-dept">
            Department
          </label>
          <input
            id="pf-dept"
            className="text-input"
            value={department}
            onChange={(event) => setDepartment(event.target.value)}
          />
          <div className="modal-actions">
            <button type="button" className="primary-button" onClick={() => void save()} disabled={!dirty || saving}>
              {saving ? 'Saving…' : 'Save profile'}
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}
