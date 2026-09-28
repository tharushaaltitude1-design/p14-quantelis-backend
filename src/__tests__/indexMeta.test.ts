import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const indexHtml = readFileSync(resolve(__dirname, '../../index.html'), 'utf8');
const publicFile = (name: string) => {
  try {
    return readFileSync(resolve(__dirname, '../../public', name), 'utf8');
  } catch {
    return null;
  }
};

const attr = (name: string) => {
  const match = indexHtml.match(new RegExp(`<meta[^>]*name=["']${name}["'][^>]*>`));
  return match?.[0] ?? null;
};

describe('index.html — an authenticated app must not be indexable', () => {
  it('declares noindex, nofollow', () => {
    const tag = attr('robots');
    expect(tag).not.toBeNull();
    expect(tag).toMatch(/content=["']noindex,\s*nofollow["']/i);
  });

  it('sets a viewport meta tag for mobile', () => {
    expect(attr('viewport')).toMatch(/width=device-width/);
  });

  it('declares a language on the html element', () => {
    expect(indexHtml).toMatch(/<html[^>]*\blang=["'][a-z-]+["']/i);
  });

  it('references a favicon and an apple-touch-icon', () => {
    expect(indexHtml).toMatch(/<link[^>]*rel=["']icon["']/);
    expect(indexHtml).toMatch(/<link[^>]*rel=["']apple-touch-icon["']/);
  });

  it('has a theme-color matching the dark shell', () => {
    expect(attr('theme-color')).toMatch(/#0B1220/i);
  });
});

describe('public/robots.txt', () => {
  const robots = publicFile('robots.txt');

  it('exists', () => {
    expect(robots).not.toBeNull();
  });

  it('disallows everything for all crawlers', () => {
    expect(robots).toMatch(/User-agent:\s*\*/i);
    expect(robots).toMatch(/Disallow:\s*\/\s*$/m);
  });
});

describe('SPA deep-link fallbacks', () => {
  // Without one of these, a hard refresh on /datasets/12 returns the host's 404 instead of the
  // app shell, and the client-side router never renders.
  it('has a Netlify _redirects catch-all', () => {
    const file = publicFile('_redirects');
    expect(file).not.toBeNull();
    expect(file).toMatch(/\/\*\s+\/index\.html\s+200/);
  });

  it('has an Apache .htaccess rewrite to index.html', () => {
    const file = publicFile('.htaccess');
    expect(file).not.toBeNull();
    expect(file).toMatch(/RewriteRule\s+\^\s+\/index\.html/);
    // The -f/-d tests must come first, or the rewrite would swallow real files like /assets/*.
    expect(file).toMatch(/%\{REQUEST_FILENAME\}\s+-f/);
    expect(file).toMatch(/%\{REQUEST_FILENAME\}\s+-d/);
  });

  it('has a Vercel rewrite to index.html', () => {
    const vercel = JSON.parse(readFileSync(resolve(__dirname, '../../vercel.json'), 'utf8'));
    expect(vercel.rewrites).toEqual(
      expect.arrayContaining([expect.objectContaining({ destination: '/index.html' })]),
    );
  });

  it('caches hashed assets immutably but never caches the app shell', () => {
    const vercel = JSON.parse(readFileSync(resolve(__dirname, '../../vercel.json'), 'utf8'));
    const assets = vercel.headers.find((h: { source: string }) => h.source === '/assets/(.*)');
    const shell = vercel.headers.find((h: { source: string }) => h.source === '/index.html');
    expect(assets.headers[0].value).toMatch(/immutable/);
    // A cached index.html would reference asset hashes that no longer exist after a deploy.
    expect(shell.headers[0].value).toMatch(/no-cache/);
  });
});
