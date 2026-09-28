import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// `process.cwd()` is the Vitest project root, which avoids depending on __dirname depth.
const ROOT = process.cwd();
const read = (p: string) => readFileSync(resolve(ROOT, p), 'utf8');
const css = () => read('src/styles/layout.css') + read('src/styles/features/auth.css');
const src = (p: string) => read(`src/${p}`);

describe('branding assets', () => {
  it('uses the original PNG favicon, and no leftover hand-drawn SVG', () => {
    const html = read('index.html');
    expect(html).toMatch(/<link[^>]*rel=["']icon["'][^>]*href=["']\/favicon\.png["']/);
    expect(html).not.toMatch(/favicon\.svg/);
    expect(html).not.toMatch(/og-image\.svg/);
  });

  it('points og:image at a real PNG, since scrapers do not render SVG', () => {
    expect(read('index.html')).toMatch(/property=["']og:image["'][^>]*content=["']\/og-image\.png["']/);
  });

  it('declares the apple-touch-icon at 180x180', () => {
    expect(read('index.html')).toMatch(/rel=["']apple-touch-icon["'][^>]*sizes=["']180x180["']/);
  });
});

describe('Logo component', () => {
  it('renders the original wordmark PNG with a Quantelis alt text', () => {
    expect(src('components/brand/Logo.tsx')).toMatch(/from '@\/assets\/logo\.png'/);
    expect(src('components/brand/Logo.tsx')).toMatch(/alt=\{alt\}/);
  });

  // Without the intrinsic size attributes the browser cannot reserve space, and the sidebar and
  // auth card jump once the logo loads.
  it('keeps the intrinsic dimensions to reserve layout space', () => {
    expect(src('components/brand/Logo.tsx')).toMatch(/width=\{1500\}/);
    expect(src('components/brand/Logo.tsx')).toMatch(/height=\{500\}/);
  });

  it('is imported by the sidebar and by the shared auth layout, so all three screens get it', () => {
    expect(src('components/layout/Sidebar.tsx')).toMatch(/import \{ Logo \} from '@\/components\/brand\/Logo'/);
    expect(src('features/auth/AuthLayout.tsx')).toMatch(/import \{ Logo \} from '@\/components\/brand\/Logo'/);
  });

  it('is used by SignIn and SignUp through AuthLayout, without duplicating markup', () => {
    expect(src('features/auth/SignInPage.tsx')).toMatch(/<AuthLayout/);
    expect(src('features/auth/SignUpPage.tsx')).toMatch(/<AuthLayout/);
  });

  it('no longer uses the placeholder TrendingUp icon as a brand mark', () => {
    expect(src('features/auth/AuthLayout.tsx')).not.toMatch(/TrendingUp/);
  });

  it('does not leave the old unreferenced magnifier LogoMark behind', () => {
    expect(src('components/brand/Logo.tsx')).not.toMatch(/LogoMark/);
    expect(src('components/brand/Logo.tsx')).not.toMatch(/circle cx=/);
  });
});

describe('logo styling', () => {
  it('sizes the logo by height with auto width, so the 3:1 aspect ratio is preserved', () => {
    expect(css()).toMatch(/\.brand-logo\s*\{[^}]*height:\s*\d+px/);
    expect(css()).toMatch(/\.brand-logo\s*\{[^}]*width:\s*auto/);
  });

  it('gives every placement its own size override', () => {
    for (const selector of ['sidebar-logo', 'auth-aside-logo', 'auth-card-logo']) {
      expect(css()).toMatch(new RegExp(`\\.${selector}\\s*\\{[^}]*height:\\s*\\d+px`));
    }
  });

  // Guards the agreed sizes. The wordmark is a 3:1 lockup, so the height is what actually sets
  // how large it reads; a regression here is invisible in the source but obvious on screen.
  it.each([
    ['the base size', '.brand-logo', '41px'],
    ['the sidebar', '.sidebar-logo', '39px'],
    ['the sign-in and sign-up screens', '.auth-aside-logo', '43px'],
    ['the auth card on mobile', '.auth-card-logo', '43px'],
  ])('renders %s at the agreed size', (_label, selector, expected) => {
    expect(css()).toMatch(new RegExp(`\\${selector}\\s*\\{[^}]*height:\\s*${expected}`));
  });

  it('gives the sidebar brand a clickable home link', () => {
    expect(css()).toMatch(/\.sidebar-brand-link/);
    expect(src('components/layout/Sidebar.tsx')).toMatch(/aria-label="Quantelis overview"/);
  });

  // The aside logo and the card logo are the same asset in the two places the marketing panel is
  // shown or hidden. Exactly one must be visible at a time, or the wordmark appears twice.
  it('shows the aside logo only when the marketing panel is visible', () => {
    expect(css()).toMatch(/\.auth-aside-logo\s*\{\s*display:\s*none/);
  });

  it('restores the aside logo and hides the card logo at desktop width', () => {
    const min = read('src/styles/responsive.css');
    expect(min).toMatch(/\.auth-aside-logo\s*\{\s*display:\s*block/);
    expect(min).toMatch(/\.auth-card-logo\s*\{\s*display:\s*none/);
  });
});
