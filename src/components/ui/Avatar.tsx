import { useState } from 'react';

type AvatarSize = 'small' | 'medium' | 'large';

type AvatarProps = {
  name: string;
  initials: string;
  /** Photo URL. Null/undefined falls back to the initials. */
  src?: string | null;
  size?: AvatarSize;
  className?: string;
  /**
   * Alternative text. Defaults to empty, which marks the image decorative — correct when the
   * owner's name is already rendered next to the avatar. Pass a description when it is not
   * (e.g. the large avatar on the profile page).
   */
  alt?: string;
};

const SIZE_CLASS: Record<AvatarSize, string> = {
  small: 'avatar-small',
  medium: '',
  large: 'avatar-large',
};

/**
 * One avatar implementation for the whole app.
 *
 * A photo URL is not a guarantee: a Google avatar URL can start 404ing, and an ad blocker can
 * swallow the request. When the image fails to load we fall back to initials rather than
 * showing a broken-image glyph, and we remember *which* URL failed so a later, new photo URL
 * still renders instead of being permanently suppressed.
 */
export function Avatar({ name, initials, src, size = 'medium', className = '', alt }: AvatarProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = Boolean(src) && failedSrc !== src;
  const classes = `avatar ${SIZE_CLASS[size]} ${className}`.trim();

  if (!showImage) {
    return (
      <span className={classes} title={name} aria-hidden="true">
        {initials}
      </span>
    );
  }

  return (
    <img
      className={`${classes} avatar-image`}
      src={src ?? undefined}
      alt={alt ?? ''}
      title={name}
      onError={() => setFailedSrc(src ?? null)}
    />
  );
}
