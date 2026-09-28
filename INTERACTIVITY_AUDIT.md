# Interactivity Audit — Quantelis Admin Dashboard

Audit of every interactive element in the Vite + React + TypeScript dashboard.
File:line references point at the **original (pre-fix)** code so the dead controls can be located.
Baseline before any change: `npm run typecheck`, `npm run lint`, `npm run build` all passed clean.

Status legend: **Fixed** · **Removed** · **Needs input**

---

## 0. Premise corrections (read this first)

Three things in the original brief do not match the code. They are recorded here rather
than silently "fixed", because acting on them literally would have damaged the app.

### 0.1 There is no duplicate logo in the sidebar

The brief asked to *remove the topmost logo and keep the other one*. The sidebar renders
**exactly one** logo:

- `src/components/layout/Sidebar.tsx:26` — `<div className="brand">` containing `<LogoMark />`
- `src/components/brand/Logo.tsx:3` — `LogoMark` is exported and referenced in **exactly one place**
  (verified by grepping every file under `src/` for `LogoMark`).

The `.workspace-icon` element (`Sidebar.tsx:27`, a rounded "Q" square) is a workspace avatar,
not a logo, and it is the natural anchor for the workspace-switcher menu. `public/favicon.svg`
and `index.html` contain no second logo, and there is no login page (`ROUTES.login` is declared
in `src/config/constants.ts:16` but no route or component uses it), so there is no second
brand surface to compare against.

**Action: no logo removed.** Deleting the only `.brand` block would have left the sidebar
with a bare gap and broken the design, which the brief explicitly forbids
("Keep the visual design identical"). Status for this item: **Needs input** — if a duplicate
logo is visible in a running build, it is coming from something not in this repository
(a browser extension, a stale service worker, or a different branch), and the reporter should
re-check. Everything else in the sidebar (workspace switcher, user chip) was made interactive.

### 0.2 There was no state layer at all

The brief assumed "context, reducer, services, or hooks, whatever exists". None existed.
All data was **static `const` arrays** in `src/data/mock.ts`, imported directly by every page.
Consequences that made the brief's requirements unreachable without change:

- `ProjectsPage.tsx:13` hard-coded "12 active projects" while rendering only 4 projects.
- `HistoryPage.tsx:12` hard-coded "287 activity records" while rendering 10 rows
  (`[...activity, ...activity]` duplicated the 5-item array to fake volume).
- `OverviewCards.tsx:13` hard-coded "32 total" in the donut card header.
- `StatsGrid.tsx` hard-coded all four stat values.
- Deleting a dataset could not be reflected anywhere, because nothing owned the list.

A single `context` + `useReducer` store was therefore added (`src/state/workspace.tsx`) and
all pages now read from it. This is the minimum needed to satisfy "adding/deleting/changing
things updates everywhere"; no routes, data shapes or component boundaries were changed.

### 0.3 Several components named in the brief do not exist

Not invented, therefore not "fixed". Listed for the record: a Team page (Team & roles is a
Settings tab), a Drawer primitive (modals only), a Table primitive (raw `<table>` markup), a
Tabs primitive (buttons in `SettingsPage`), a scenario builder with objective/operator selects
(a scenario *library* only), a date-range *popover* (a working native `<select>` already
existed on Overview), dataset-detail tabs, an integrations table with row menus, and
page-size/sort selectors. Where a control was genuinely useful but missing, it was added to
an existing screen rather than as a new one.

---

## 1. Findings inventory (original state)

Counts: 74 interactive elements inventoried. 61 were dead, 13 partially worked.

---

### 1.1 Layout — Topbar

| # | Page/Component | Control | File:line (original) | Expected behaviour | Status |
|---|---|---|---|---|---|
| 1 | Topbar | Global search input | `src/components/layout/Topbar.tsx:15` | Filter/open results across workspace; `⌘K`/`Ctrl+K` opens palette | **Fixed** |
| 2 | Topbar | `⌘ K` hint chip | `Topbar.tsx:15` | Pure decoration, no handler | **Fixed** (now opens palette on click) |
| 3 | Topbar | Profile chip | `Topbar.tsx:18` | Navigate only; `ChevronDown` implied a menu that never opened | **Fixed** |
| 4 | Topbar | "New project" button | `Topbar.tsx:17` | Navigated to `/projects?new=true`, but `ProjectsPage` never read the param — dead | **Fixed** |
| 5 | Topbar | Mobile menu button | `Topbar.tsx:12` | Worked | **Fixed** (unchanged) |
| 6 | Notifications | "Mark all read" | `src/components/layout/NotificationsMenu.tsx:23` | Dead; unread count was a static `ITEMS.length` | **Fixed** |
| 7 | Notifications | Bell toggle | `NotificationsMenu.tsx:20` | Toggled state, but the panel had **no positioning rule** — see §4.1 | **Fixed** (portaled + `position: fixed`) |
| 8 | Notifications | Per-item row | `NotificationsMenu.tsx:25` | Navigated but never marked read | **Fixed** |
| 9 | Notifications | Unread badge | `NotificationsMenu.tsx:20` | Always-on dot, no unread semantics | **Fixed** |

### 1.2 Layout — Sidebar

| # | Page/Component | Control | File:line (original) | Expected behaviour | Status |
|---|---|---|---|---|---|
| 10 | Sidebar | Brand/logo | `Sidebar.tsx:26` | Asserted duplicate; **only one logo exists** | **Needs input** (§0.1) |
| 11 | Sidebar | Workspace switcher | `Sidebar.tsx:27` | Dead `<div>` with a `ChevronDown`; no `onClick` | **Fixed** |
| 12 | Sidebar | User chip "…" | `Sidebar.tsx:36` | `MoreHorizontal` inside a `NavLink` — icon not clickable, row always navigated to `/profile` | **Fixed** |
| 13 | Sidebar | Help card | `Sidebar.tsx:35` | Looked clickable (chevron), was a dead `<div>` | **Fixed** |
| 14 | Sidebar | Nav items | `Sidebar.tsx:12` | Worked | **Fixed** (unchanged) |
| 15 | Sidebar | Backdrop / Escape close | `Sidebar.tsx:19-24` | Worked | **Fixed** (unchanged) |

### 1.3 Overview

| # | Page/Component | Control | File:line (original) | Expected behaviour | Status |
|---|---|---|---|---|---|
| 16 | Overview | Date range select | `src/features/overview/OverviewPage.tsx:13` | Already controlled and working | **Fixed** (unchanged) |
| 17 | StatsGrid | 4 stat values | `src/features/overview/StatsGrid.tsx:8-11` | Hard-coded `"8"`, `"12"`, `"146"`, `"24"`, `"92.4%"` | **Fixed** (derived from state) |
| 18 | StatCard ×4 | "…" options | `src/components/ui/StatCard.tsx:11` | `aria-label` present, no `onClick` — dead | **Fixed** |
| 19 | ProjectsByStatus | Donut header total | `src/features/overview/OverviewCards.tsx:13` | Hard-coded "32 total" | **Fixed** |
| 20 | RunsOverTime | Chart "…" | `OverviewCards.tsx:22` | Dead | **Fixed** |
| 21 | RunsOverTime | "Total 287 runs" | `OverviewCards.tsx:23` | Hard-coded | **Fixed** |
| 22 | TopScenarios | "View all" | `OverviewCards.tsx:33` | Dead `<button>` | **Fixed** |
| 23 | RecentActivity | "View history" | `OverviewCards.tsx:42` | Dead `<button>` | **Fixed** |
| 24 | Enterprise callout | "Explore enterprise" | `OverviewCards.tsx:64` | Dead | **Removed** (no destination exists; no URL may be invented) |

### 1.4 Datasets

| # | Page/Component | Control | File:line (original) | Expected behaviour | Status |
|---|---|---|---|---|---|
| 25 | Datasets | Search input | `src/features/datasets/DatasetsPage.tsx:33` | Worked (controlled), but no clear button / Escape | **Fixed** |
| 26 | Datasets | "Filter" + count `2` | `DatasetsPage.tsx:35-37` | Dead button, hard-coded filter count | **Fixed** |
| 27 | Datasets | Row "…" ×N | `DatasetsPage.tsx:74` | Dead | **Fixed** |
| 28 | Datasets | Pagination `1 2 ›` | `DatasetsPage.tsx:97-101` | Three dead buttons; page 2 empty; count ignored `filtered` | **Fixed** |
| 29 | Datasets | Empty state "Clear search" | `DatasetsPage.tsx:82-90` | Worked | **Fixed** (unchanged) |
| 30 | Datasets | "Upload dataset" | `DatasetsPage.tsx:25` | Opened the modal | **Fixed** (unchanged) |
| 31 | Upload modal | Drop zone | `src/features/datasets/UploadDatasetModal.tsx:10` | `<div onClick>` that faked a filename; no `<input type="file">`, no drag/drop, no validation | **Fixed** |
| 32 | Upload modal | "Dataset name" | `UploadDatasetModal.tsx:26` | Uncontrolled, `defaultValue`-less, never read | **Fixed** |
| 33 | Upload modal | "Add dataset" | `UploadDatasetModal.tsx:32` | Just called `onClose` — **fake success**, no record created | **Fixed** |
| 34 | Dataset detail | "Preview data" | `src/features/datasets/DatasetDetailModal.tsx:46` | Dead | **Fixed** |
| 35 | Dataset detail | Quality score `98.4%` | `DatasetDetailModal.tsx:31` | Hard-coded per dataset | **Fixed** |
| 36 | Dataset detail | Variables list | `DatasetDetailModal.tsx:35` | Same 5 variables for every dataset | **Fixed** |

### 1.5 Projects

| # | Page/Component | Control | File:line (original) | Expected behaviour | Status |
|---|---|---|---|---|---|
| 37 | Projects | "12 active projects" | `src/features/projects/ProjectsPage.tsx:13` | Hard-coded, contradicted the 4 rendered cards | **Fixed** |
| 38 | Projects | "3 forecasts running today" | `ProjectsPage.tsx:14` | Hard-coded | **Fixed** |
| 39 | Projects | "Filters" | `ProjectsPage.tsx:17` | Dead | **Fixed** |
| 40 | Projects | Card "…" ×N | `ProjectsPage.tsx:33` | Dead | **Fixed** |
| 41 | Projects | "Open" | `ProjectsPage.tsx:53` | Dead | **Fixed** |
| 42 | Wizard | Dataset choice rows | `src/features/projects/NewProjectWizard.tsx:40` | No `onClick`; selection hard-coded to `index === 0` | **Fixed** |
| 43 | Wizard | Forecast variable select | `NewProjectWizard.tsx:59` | Uncontrolled native `<select>` | **Fixed** |
| 44 | Wizard | Horizon select | `NewProjectWizard.tsx:67` | Uncontrolled | **Fixed** |
| 45 | Wizard | Seasonality toggle | `NewProjectWizard.tsx:78` | `<span className="toggle on">` — decorative, no `role="switch"`, dead | **Fixed** |
| 46 | Wizard | Review step values | `NewProjectWizard.tsx:88-92` | **All four rows hard-coded**, ignored the actual selection | **Fixed** |
| 47 | Wizard | Continue / Back | `NewProjectWizard.tsx:111-115` | Worked, but with no validation | **Fixed** |
| 48 | Wizard | "Run forecast" | `NewProjectWizard.tsx:114` | Set `running`, which rendered a **hard-coded "64%"** bar that never animated and never completed — **hung forever** | **Fixed** |
| 49 | Wizard | Success / "View results" | *absent* | Did not exist; the run never finished | **Fixed** |

### 1.6 Scenarios

| # | Page/Component | Control | File:line (original) | Expected behaviour | Status |
|---|---|---|---|---|---|
| 50 | Scenarios | "Filter" | `src/features/scenarios/ScenariosPage.tsx:16` | Dead | **Fixed** |
| 51 | Scenarios | "Create scenario" | `ScenariosPage.tsx:19` | Dead | **Fixed** |
| 52 | Scenarios | Checkbox rows | `ScenariosPage.tsx:39-46` | Worked but **uncapped** — brief requires max 4 | **Fixed** |
| 53 | Scenarios | "Compare N scenarios" | `ScenariosPage.tsx:30-32` | `onClick={() => setCompare([])}` — **actively cleared the selection instead of comparing** | **Fixed** |
| 54 | Scenarios | Row "…" ×N | `ScenariosPage.tsx:57` | Dead | **Fixed** |
| 55 | Scenarios | "Learn about optimization" | `ScenariosPage.tsx:73` | Dead | **Removed** (no docs route exists) |
| 56 | Scenarios | "Across 3 forecasting projects" | `ScenariosPage.tsx:13` | Hard-coded | **Fixed** |

### 1.7 Results & History

| # | Page/Component | Control | File:line (original) | Expected behaviour | Status |
|---|---|---|---|---|---|
| 57 | History | "287 activity records" | `src/features/history/HistoryPage.tsx:12` | Hard-coded, list was `[...activity, ...activity]` | **Fixed** |
| 58 | History | Search input | `HistoryPage.tsx:28` | Uncontrolled `<input placeholder>` with no `onChange` — **dead** | **Fixed** |
| 59 | History | Filter chips `×` | `HistoryPage.tsx:31-36` | `<span>` with an `X` icon; not clickable, not removable | **Fixed** |
| 60 | History | "Add filter" | `HistoryPage.tsx:16` | Dead | **Fixed** |
| 61 | History | Toolbar "…" | `HistoryPage.tsx:19` | Dead | **Fixed** |
| 62 | History | Row "Details" | `HistoryPage.tsx:49` | Dead `<button>` | **Fixed** |

### 1.8 Settings

| # | Page/Component | Control | File:line (original) | Expected behaviour | Status |
|---|---|---|---|---|---|
| 63 | Settings | Tabs | `src/features/settings/SettingsPage.tsx:11` | Worked, but not reflected in the URL | **Fixed** (`?tab=` synced) |
| 64 | Settings | Workspace name | `SettingsPage.tsx:22` | `defaultValue`, no `onChange` | **Fixed** |
| 65 | Settings | Timezone select | `SettingsPage.tsx:26` | Uncontrolled | **Fixed** |
| 66 | Settings | Currency select | `SettingsPage.tsx:32` | Uncontrolled | **Fixed** |
| 67 | Settings | "Save changes" | `SettingsPage.tsx:38` | Dead | **Fixed** |
| 68 | Notifications tab | 4 switches | `SettingsPage.tsx:54` | `<span className="toggle on">` — decorative, **all dead**, `index < 3` hard-coded | **Fixed** |
| 69 | Team & roles | Row "…" ×N | `SettingsPage.tsx:79` | Dead | **Fixed** |
| 70 | Team & roles | "Invite member" | `SettingsPage.tsx:86` | Dead | **Fixed** |
| 71 | Team & roles | Role badge | `SettingsPage.tsx:78` | Static; no way to change a role | **Fixed** |
| 72 | Billing | "Manage plan" | `SettingsPage.tsx:105` | Dead | **Fixed** |
| 73 | Billing | 4× "Explore plan" / "Current plan" | `SettingsPage.tsx:119` | Dead ×4 | **Fixed** |
| 74 | API & integrations | "Reveal" | `SettingsPage.tsx:132` | Dead; the key is a masked literal in a `readOnly` input | **Fixed** |
| 75 | API & integrations | "Connect" | `SettingsPage.tsx:143` | Dead | **Fixed** |

### 1.9 Security & Profile

| # | Page/Component | Control | File:line (original) | Expected behaviour | Status |
|---|---|---|---|---|---|
| 76 | Security | 3 password inputs | `src/features/security/SecurityPage.tsx:12,16` | Uncontrolled, no `onSubmit` | **Fixed** |
| 77 | Security | "Update password" | `SecurityPage.tsx:18` | Dead; no validation | **Fixed** |
| 78 | Security | 2FA toggle | `SecurityPage.tsx:31` | `<span className="toggle">` — decorative, dead | **Fixed** |
| 79 | Security | "Sign out" session | `SecurityPage.tsx:54` | Dead | **Fixed** |
| 80 | Security | "2 devices signed in" | `SecurityPage.tsx:37` | Hard-coded | **Fixed** |
| 81 | Profile | "Upload photo" | `src/features/profile/ProfilePage.tsx:13` | Dead | **Fixed** |
| 82 | Profile | Full name / email / department | `ProfilePage.tsx:20,24,37` | `defaultValue`, uncontrolled | **Fixed** |
| 83 | Profile | Job role select | `ProfilePage.tsx:28` | Uncontrolled | **Fixed** |
| 84 | Profile | "Save profile" | `ProfilePage.tsx:39` | Dead | **Fixed** |

---

## 2. Shared primitives that had to be created

None of these existed; the brief requires one shared implementation used everywhere.

| Primitive | Why it was needed | Status |
|---|---|---|
| `Menu` (portaled, anchored, keyboard-driven) | 9 dead 3-dot buttons, workspace switcher, profile chip, 4 filter buttons | **Fixed** |
| `ConfirmDialog` | Destructive row actions (delete dataset/project/scenario, remove member, sign out session) | **Fixed** |
| `SearchInput` | 3 search inputs with no clear/Escape behaviour | **Fixed** |
| `Select` | 7 uncontrolled native selects | **Fixed** |
| `Pagination` | 1 set of dead page buttons | **Fixed** |
| `Toaster` (`aria-live`) | No feedback mechanism existed at all | **Fixed** |
| `useTableState` | Brief requires search+filter+sort+page to compose, not be reimplemented per page | **Fixed** |
| `GlobalSearch` (⌘K palette) | Topbar search was a dead input | **Fixed** |
| z-index scale (`--z-*` tokens) | Ad-hoc values 30/40/50/100/200, no single scale | **Fixed** |

## 3. Verification

See `## 4` for the final verification record.

---

## 4. Verification record

All four gates pass on the final tree:

| Gate | Command | Result |
|---|---|---|
| Types | `npm run typecheck` | clean |
| Lint | `npm run lint` | clean |
| Tests | `npm test` | **71 passed** in 8 files |
| Build | `npm run build` | succeeded |

`npm test` runs Vitest in a jsdom environment (`vite.config.ts`, `src/test/setup.ts`) and is
now wired to `npm run test` / `npm run test:watch`.

### 4.1 The notification bell was still broken after the first pass

The first fix pass portaled the panel out of the sticky topbar but only passed it the
`notifications-panel` class. That class never declared `position`; the positioning primitives
lived in `.menu-panel`, which this call site did not use. A portaled element with no `position`
is **static**, so the panel was appended to the bottom of `<body>`, the computed `top`/`left`
were ignored, and clicking the bell appeared to do nothing — the panel opened below the fold.

Fixed structurally rather than at the call site: the shared surface is now
`.popover-panel` (`position: fixed`, `z-index`, background, border, shadow, scroll containment),
and `Popover.tsx` applies it itself, so a floating panel cannot be shipped unpositioned again.
`.menu-panel` keeps only its menu-specific sizing, and `.notifications-panel` only its width.

Covered by `src/components/layout/__tests__/NotificationsMenu.test.tsx` (5 tests): open from the
bell, `aria-expanded` toggling, the `popover-panel` regression assertion, mark-all-read updating
the unread count, a single row marking read + closing + navigating, outside-press and Escape
dismissal, and the disabled state when nothing is unread.

### 4.2 Other defects found and fixed while testing

| Defect | Cause | Fix |
|---|---|---|
| Filters ignored when the search box was empty | `useTableState` short-circuited to unfiltered rows when `search` was blank | `src/hooks/useTableState.ts` now always applies the filter pipeline; regression tests added |
| Toasts replaced each other at the cap | Toasts were keyed by `Date.now()`; three in the same millisecond collided | monotonic `toastSeq` in `src/state/workspaceReducer.ts` |
| "New feed" dataset test failed to typecheck | test payload passed `updated`, which the reducer derives | test payload corrected |
