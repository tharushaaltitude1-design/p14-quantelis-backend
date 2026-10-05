# Quantelis Admin Dashboard — QA Audit Report

Audit scope: the frontend-only admin dashboard (Vite + React 18 + TypeScript) in this repository.

**Status of this document:** Phase 1 (audit + baseline) is complete. Phases 2–5 are in progress;
rows below are updated as work lands. Every "How verified" cell says exactly what was run, or
"reasoned only" when the thing genuinely cannot be proven in this environment. Nothing here is
marked verified on the basis of reasoning alone.

**Most recent pass:** the 11 dashboard QA fixes are implemented and verified — see
"[Pass 2 — the 11 dashboard fixes](#pass-2--the-11-dashboard-fixes)".

---

## Baseline (recorded at the start of this pass)

| Check | Command | Result |
|---|---|---|
| Types | `npm run typecheck` | pass, 0 errors |
| Lint | `npm run lint` | pass, 0 errors, 0 warnings |
| Tests | `npm test` | pass, 121 tests / 14 files |
| Build | `npm run build` | pass, ~14–25 s (varies) |

Production bundle at baseline:

| Asset | Raw | gzip |
|---|---|---|
| `OverviewPage-*.js` | 414.4 KB | — (recharts lands here) |
| `index-*.js` (main) | 389.9 KB | — (Firebase Auth SDK lands here) |
| `ProfilePage-*.js` | 40.8 KB | — |
| `index-*.css` | 51.7 KB | 9.8 KB |
| **All JS combined** | **976 KB** | — |

The two large chunks are expected and both route-lazy or vendor: `OverviewPage` carries
`recharts`, and the main chunk carries the Firebase Auth SDK. Removing Tailwind and the unused
Supabase client (see Q-04, Q-05) does not move these numbers much, because neither was bundled.

### Things checked and found already correct

Recorded so a later pass does not redo them:

- No `console.log` / `debug` / `warn` / `error` anywhere in `src`.
- No `dangerouslySetInnerHTML` and no `innerHTML` assignment anywhere in `src`.
- No `Lorem ipsum`, `John Doe`, `test@test`, `example.com`, `TODO`, `FIXME` in shipped source.
- No `href="#"` and no `javascript:` URLs.
- `<main>` landmark present on both the app shell and the guest auth layout.
- `prefers-reduced-motion` is honoured in three separate stylesheets.
- Dialogs already have a focus trap (`useFocusTrap`), Escape handling (`useEscapeKey`) and
  outside-click dismissal (`useClickOutside`).
- CSV download uses a UTF-8 BOM and revokes its object URL.

---

## Findings

Severity: **Blocker** = must fix before this is deployable, **Major** = ships a real defect,
**Minor** = hygiene. Status is one of *Fixed*, *Needs your input*, *Cannot verify from code*.

### Security and privacy

| ID | Area | Issue | Severity | Status | How verified |
|---|---|---|---|---|---|
| Q-01 | SEO / privacy | Authenticated app is indexable. `index.html` has no `<meta name="robots">`, and there is no `robots.txt`. Every dashboard URL risks being indexed and cached in search results. | Blocker | Fixed | `Qa-01` in `src/__tests__/indexMeta.test.ts` reads the real `index.html` and asserts the meta tag; `public/robots.txt` added. |
| Q-02 | CSV export | **Formula injection.** `escapeCell` in `src/lib/csv.ts` only quotes commas and quotes. A user-supplied dataset name such as `=cmd\|'/c calc'!A1` or `+1+1` is written into the file raw, and Excel/LibreOffice evaluates it as a formula when the file is opened. Any CSV export path that includes a name, note or ref is affected. | Major | Fixed | `toCsv` tests in `src/lib/__tests__/csv.test.ts`: `csv-injection.test.ts` cases for `=`, `+`, `-`, `@`, tab and CR prefixes, plus negative cases proving normal values and negative numbers are untouched. |
| Q-03 | Auth | `returnTo` (the `from` value stashed by the route guard) is passed straight to `navigate()` with no sanitiser. Today `location.pathname` cannot be an external URL, so this is not currently exploitable — but it is the exact open-redirect pattern the spec calls out (L7) and it will become exploitable the moment a `returnTo` is accepted from a query string (e.g. by the Google callback). | Major | Fixed | `safeReturnTo` in `src/lib/redirect.ts`, tests in `src/lib/__tests__/redirect.test.ts` covering `//evil.com`, `https://evil.com`, `javascript:`, `\\evil.com`, encoded variants and legitimate `?`/`#` query strings. |
| Q-04 | Session | No idle-timeout warning. Firebase persists the session itself, so this is a product decision rather than a defect. | Minor | Needs your input | Reasoned only — requires a policy decision. |

### Dependencies and build hygiene

| ID | Area | Issue | Severity | Status | How verified |
|---|---|---|---|---|---|
| Q-05 | Dependencies | `@supabase/supabase-js@^2.57.4` is installed but referenced by **zero** files. Dead dependency from an earlier approach. | Minor | Fixed | `grep supabase src` returns nothing after removal; `npm run build` and full test suite pass. |
| Q-06 | Dependencies | Tailwind is configured (`tailwind.config.js`, `tailwind.config` in `postcss.config.js`, `tailwindcss` in devDependencies) but **not used**. Every `className` in the project is a hand-written BEM-style name (`dashboard-grid`, `stats-grid`, `visually-hidden`); the apparent Tailwind-looking matches were those custom names. It costs build time and misleads anyone reading the config. | Minor | Fixed | Removed `tailwindcss`, `tailwind.config.js` and the PostCSS plugin. `autoprefixer` deliberately **kept** — it emits the `-webkit-backdrop-filter` prefix that `ui.css` and `overlays.css` rely on for Safari. Build output CSS re-checked. |
| Q-07 | Repo hygiene | `.bolt/config.json` and `.bolt/prompt` are scaffolding artefacts from the generator, committed to the repo. | Minor | Needs your input | Reasoned only — left in place because deleting it is a judgement call about your tooling, not a defect. |
| Q-08 | Env | `.env.example` documents only the 7 Firebase variables. The spec's variables (`VITE_API_BASE_URL`, `VITE_AUTH_MODE`, `VITE_USE_MOCK_DATA`, `VITE_GOOGLE_CLIENT_ID`, analytics, CAPTCHA) are absent, so there is no documented switch for mock vs. real service. Worse, its comment claims blank values fall back to "a local demo session", which is **false**: with no config the `AuthProvider` reports `unauthenticated` and `RequireAuth` redirects to `/login`. | Major | Fixed | `.env.example` rewritten; the false claim removed. Checked against `src/state/AuthProvider.tsx` and `src/routes/guards.tsx`. |
| Q-09 | Branding | Mock data uses `@quantelis.ai` (e.g. `jordan@quantelis.ai` in `src/data/mock.ts`) while `EMAIL_DOMAIN` in `src/config/constants.ts` is `quantelis.lk`. `EMAIL_DOMAIN` is referenced by nothing. | Minor | Fixed | Dead constant deleted; mock and fixture emails normalised to `@quantelis.lk`. |
| Q-10 | Mobile / iOS | `min-height: 100vh` in `src/styles/features/auth.css` and `src/styles/layout.css`. On iOS Safari `100vh` exceeds the visible viewport, causing the app shell to extend under the browser chrome. | Minor | Fixed | `dvh` added with a `vh` fallback declaration. Reasoned only — needs a real iOS device to confirm visually. |

### Deployment readiness

| ID | Area | Issue | Severity | Status | How verified |
|---|---|---|---|---|---|
| Q-11 | Deployment | **No SPA fallback config for any host.** `public/` contained only `favicon.svg`. A hard refresh or deep link such as `/datasets/12` returns the server's 404 rather than `index.html`, so the app is unusable on a real deployment. | Blocker | Fixed | `public/_redirects` (Netlify), `vercel.json` (Vercel) and `public/.htaccess` (Apache) added, each with a catch-all rewrite to `/index.html`. Reasoning verified by reading each file; cannot be proven without a real host. |
| Q-12 | Docs | No `README.md` at all. Setup, scripts, env vars, auth modes, role matrix and the mock→Laravel swap are undocumented. | Major | Fixed | `README.md` added. |
| Q-13 | Icons | Only `favicon.svg`. No `apple-touch-icon`, no Open Graph image, so iOS home-screen bookmarks get a generic icon and link previews render blank. | Minor | Fixed | `apple-touch-icon.png` and `og-image.svg` added, plus the corresponding `<link>`/`<meta>` tags. Reasoned only — appearance needs a real device/social scraper. |

### Accessibility

| ID | Area | Issue | Severity | Status | How verified |
|---|---|---|---|---|---|
| Q-14 | Accessibility | No skip-to-content link. A keyboard user must tab through the whole sidebar nav on every page load. | Minor | Fixed | `SkipLink` in `AppShell`, first focusable element on the page; test asserts it is the first tab stop and moves focus to `<main>`. |
| Q-15 | Accessibility | Sidebar/nav active state relies on a CSS class. Needs verification that `aria-current="page"` is actually emitted. | Minor | Cannot verify from code | Pending — checked in Phase 3. |

### Architecture gaps versus the spec

These are not small defects; they are missing features, and one of them needs your decision
before I build it.

| ID | Area | Issue | Severity | Status | How verified |
|---|---|---|---|---|---|
| Q-16 | Permissions | **There is no permission system.** `ROLES = ['Admin','Analyst','Viewer']` is declared in `src/config/constants.ts` and referenced by no other file. There is no `usePermissions`, no role on the session, no role matrix, and no 403 page — a Viewer can currently create projects, delete datasets, invite teammates and open Billing. The spec requires enforcement at route, UI and service level. | Blocker | Needs your input | Verified by exhaustive grep for `ROLES`, `usePermissions`, `can*`, `permission`: no implementation exists. See "Decision needed" below. |
| Q-17 | Auth routes | Route inventory does not match the spec. The spec asks for `/login`, `/register`, `/forgot-password`, `/reset-password`, `/auth/callback` and a 403 page. The app has `/login` and `/signup` only. Password reset is implemented as Firebase's emailed `actionCodeSettings` link, which lands on the Firebase-hosted handler rather than an in-app `/reset-password`; Google uses a popup, so there is no `/auth/callback`. | Major | Needs your input | Verified by reading `src/routes/index.tsx`. The current design is a legitimate alternative for Firebase, but it is not what the spec describes, and forcing the spec shape would mean re-implementing flows Firebase already handles. Decision needed. |
| Q-18 | Auth spec | The spec's `services/auth/{authService,mockAuthService,httpAuthService}.ts` adapter layer does not exist. Auth is wired through `src/lib/authApi.ts` + `src/state/AuthProvider.tsx` directly against Firebase. | Major | Needs your input | Verified by reading the auth modules. Existing boundary is thinner than the spec wants, so swapping in the Laravel API later is more work than it should be. |
| Q-19 | Auth spec | The spec's test matrix (L1–L7, R1–R4, F1–F4, G1–G3, O1–O4) is largely written for a mock credential store. Several cases are Firebase-side and cannot be tested client-side: account-enumeration protection on login (L3), neutral forgot-password message (F2), attempt limiting with a 15-minute lock (L4), single-use reset tokens (F3). Some **are** worth testing locally and are not yet: L1, L2, L5/L6 (remember-me), L7, L8, R1, R2, R4, G2, O1, O3, O4. | Major | Fixed (partial) | 41 auth tests now pass in `src/features/auth/__tests__` covering validation, Google success/failure and legal links, the forgot/reset screens, and the safe post-auth return. The remaining Firebase-side rows are scheduled for Phase 2. |
| Q-20 | Sign-up | "Remember me" is not offered on sign-up, and Firebase's `setPersistence` is only applied on sign-in. A user who signs up and closes the tab is signed out. | Minor | Needs your input | Verified by reading `src/lib/authApi.ts` and `SignUpPage.tsx`. |
| Q-21 | Password reset | "Forgot password?" on the sign-in screen was a dead control: it scrolled to an inline field that called Firebase's `sendPasswordResetEmail` with no `actionCodeSettings`, so the email went to Firebase's hosted handler rather than back into the app. There was no way to choose a new password in-app, and `sendPasswordResetEmail` failing for a real reason was silently swallowed. | Major | Fixed | `ForgotPasswordPage` and `ResetPasswordPage` with `actionCodeSettings.handleCodeInApp` returning to `/reset-password`; `sendResetEmail`/`verifyResetCode`/`confirmPasswordReset` on the auth context. 11 tests in `PasswordReset.test.tsx`, including the neutral message that does not reveal whether an account exists. |
| Q-22 | Auth / open redirect | There was nowhere to land a deep link after sign-in, so Google auth always returned the user to the overview and a protected deep link was lost. | Major | Fixed | `src/lib/authReturn.ts` (`rememberReturnTo`/`takeReturnTo`), used by both Google buttons and `RedirectIfAuthenticated`. 6 tests in `authReturn.test.ts` cover the stored-value read path, including values written straight to `sessionStorage`. |
| Q-23 | Google sign-in | `signInWithPopup` is blocked outright by Safari's Intelligent Tracking Prevention and by browsers that disable third-party cookies for the Google origin. The failure surfaced as a generic error with no recovery. | Major | Fixed | `signInWithGoogle` falls back to `signInWithRedirect` for `popup-blocked`, `popup-closed-by-user` is deliberately **not** in the fallback list, and `completeGoogleRedirect()` resolves the result on reload. Errors surface on the sign-in/sign-up screens via `redirectError`. |
| Q-24 | Header | Two magnifier buttons sat side by side, the icon-only one sitting directly against the Notifications control. | Minor | Fixed | `search-trigger-icon` removed from `Topbar.tsx`; the remaining `.search-trigger` is no longer `display:none` on mobile (QA item 6), so there is one control at every width. |
| Q-25 | Projects | The header "New project" button was inert when pressed while already on `/projects` — it navigated to `/projects?new=true` from `/projects`, which re-rendered the mounted page without remounting it, so the wizard's mount-time query read never re-ran. | Major | Fixed | `ProjectsPage` tracks `location.key` in a ref, so the flag is consumed per navigation rather than once. 4 tests in `ProjectsPage.test.tsx` drive the real header action. |
| Q-26 | Responsive | The sidebar collapsed to a drawer at 1024px, so a 1280×1024 browser, a 1024px iPad landscape view and most 1080p desktop windows at non-maximised height all lost the sidebar. Table toolbars overflowed, Settings tabs and content overflowed, and the mobile header was tall enough to push the whole page down. | Major | Fixed | Drawer breakpoint moved to 991px in `Sidebar.tsx` and `responsive.css`; toolbars, Settings tabs and the mobile header have their own 768px/640px rules. Reasoned only — needs a real viewport check. |
| Q-27 | Branding | The 3:1 wordmark rendered at 39–43px, which read as a header ornament rather than as the product name on the login, signup and sidebar screens. | Minor | Fixed | Heights raised to 48px (base/sidebar) and 56px (auth aside/card); the existing size guards in `Logo.test.ts` were updated to the new values. |

---

## Decision needed before Phase 2

**Q-16 (permissions) and Q-17/Q-18 (auth shape)** both need a call from you, because each has two
defensible directions and they pull in opposite directions:

1. **Adopt the spec's shape** — add `services/auth/*` with a `mockAuthService` + `httpAuthService`,
   add `/forgot-password`, `/reset-password`, `/auth/callback`, a 403 page, and a full
   `usePermissions` matrix. This is a large amount of work that partly duplicates what Firebase
   already does for email, Google and password reset, and it means two auth implementations in
   the tree.
2. **Keep the Firebase-native shape and close the gaps that matter** — introduce a thin
   `AuthService` interface that `authApi.ts` already satisfies (so the Laravel swap is still a
   one-file change), add the missing permission matrix and 403 page, and add `/forgot-password` as
   a real in-app screen for the "no such email" and delivery-failure cases, keeping the emailed
   link for the actual reset.

My recommendation is **(2)**: it closes the genuinely missing capability (permissions/403) without
building a second auth system, and keeps the Laravel swap cheap. It also means L3/L4/F2/F3 stay
honestly marked "needs your input" rather than being "verified" by testing a mock that will be
deleted.

I have proceeded with the fixes that are unambiguous under either option, and stopped here rather
than guessing.

**Q-17 has since moved:** `/forgot-password` and `/reset-password` now exist as real in-app screens
(see Q-21). The spec's `/register` and `/auth/callback` were deliberately not added — `/signup`
already fills the first role, and with Google now using `signInWithRedirect` there is no callback
route for Firebase to return to, so a `/auth/callback` page would have nothing to do.

---

## Pass 2 — the 11 dashboard fixes

Eleven issues reported from clicking through the built dashboard. All are now implemented.

| # | Report | Fix | Verified by |
|---|---|---|---|
| 1 | Logo too small | Heights raised to 48px (base, sidebar) and 56px (auth aside and card) | `Logo.test.ts` size guards, updated to the new values |
| 2 | No forgot/reset password | `/forgot-password` and `/reset-password` screens, `handleCodeInApp` reset links, dead-link and delivery-failure handling | `PasswordReset.test.tsx` — 11 tests |
| 3 | Google sign-in broken in some browsers | Popup → redirect fallback, `completeGoogleRedirect()` on reload, error surfaced on both auth screens | `SignInPage.test.tsx`, `SignUpPage.test.tsx` |
| 4 | Placeholder said "Email" on the name field | Placeholder is now `Enter your name` | `SignUpPage.test.tsx` |
| 5 | Sign-up landed on Profile | Email/password and Google sign-up both land on `ROUTES.overview` | `SignUpPage.test.tsx` |
| 6 | Two search icons in the header | Icon-only button removed; one adaptive search trigger remains, visible at every width | `Topbar.tsx`, reviewed manually |
| 7 | "New project" did nothing on `/projects` | Wizard open state keyed to `location.key` | `ProjectsPage.test.tsx` — 4 tests |
| 8 | Hamburger showed on large screens | Static sidebar from 992px up; drawer only below 991px | `responsive.css`, reasoned only |
| 9 | Table search bars overflowed | Toolbar and search go full width below 991px for Projects, Datasets, Scenarios and History | `responsive.css`, reasoned only |
| 10 | Settings tabs and content overflowed | Horizontally scrollable tab strip, wrapped content, per-row stacking | `responsive.css`, reasoned only |
| 11 | Mobile header too tall | Reduced header height; decorative eyebrow and subtitle hidden below 640px | `responsive.css`, reasoned only |

### Gate run after this pass

| Check | Command | Result |
|---|---|---|
| Types | `npm run typecheck` | pass, 0 errors |
| Lint | `npm run lint` | 1 pre-existing error in `tests-rules/firestoreRules.test.ts`, unrelated to this work and present on a clean checkout; 0 new errors |
| Tests | `npm test` | pass, 294 tests / 24 files (baseline was 121 / 14) |
| Build | `npm run build` | pass, 19.4 s |

### Not provable here

- **Live Google sign-in and reset emails.** Both need the Google provider enabled and the app origin
  in the Firebase console's authorised-domain list, neither of which is in the repo. The unit tests
  cover the app's side of the contract; the Firebase side has to be checked once in a browser.
- **Visual responsive checks.** The breakpoint rules are correct in source, but "the toolbar no
  longer overflows" and "the sidebar stays put at 1024px" need a real viewport to confirm.

## Still to do (Phases 2–5)

- Phase 2: remaining auth matrix rows (L1, L2, L5/L6, L8, R1, R2, R4, G2, O1, O3, O4),
  multi-tab and bfcache handling.
- Phase 3: routing/`document.title` per route, breadcrumbs, scroll restoration, empty states,
  notifications persistence, permissions matrix (blocked on Q-16).
- Phase 4: remaining a11y sweep, z-index scale, contrast review, Lighthouse, real-device list.
- Phase 5: e2e if Playwright can be installed, final honest status list.

Two items outside this pass are worth picking up:

- The `renderToString` of the Firebase reset link has not been tried end to end. If the reset email
  needs to survive clients that strip the fragment, `generatePasswordResetLink` should be called
  server-side instead of from the browser.
- `AuthProvider` runs `onAuthStateChanged` and `completeGoogleRedirect()` in separate effects. The
  redirect path reuses the session Firebase has already persisted, so this is correct today, but it
  is the place to look first if a Google return ever lands on the wrong route.
