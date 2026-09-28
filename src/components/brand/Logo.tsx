import logoUrl from '@/assets/logo.png';

/**
 * The Quantelis wordmark, used everywhere the brand appears.
 *
 * The source asset is a transparent PNG (1500x500, with the artwork inset), so it can be dropped
 * straight onto the dark shell and the light pixels of the wordmark stay legible. Sizing is done
 * entirely in CSS (`.brand-logo` plus a placement modifier) rather than with inline styles or a
 * numeric prop, so each placement can pick its own size without this component knowing about it.
 *
 * The intrinsic `width`/`height` attributes are kept so the browser can reserve the correct box
 * before the image loads — without them the header and sidebar shift once the logo arrives, which
 * is exactly the kind of layout jump the performance pass is meant to avoid.
 */
export function Logo({ className = '', alt = 'Quantelis' }: { className?: string; alt?: string }) {
  return <img className={`brand-logo ${className}`.trim()} src={logoUrl} alt={alt} width={1500} height={500} />;
}
