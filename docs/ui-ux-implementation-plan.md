# BookVault UI/UX Implementation Plan

This document is the implementation roadmap and handoff reference for improving BookVault’s UI and UX.

## Current status

| Phase | Status |
|---|---|
| Phase 0 — Stabilization | ✅ Completed |
| Phase 1 — Shared UI foundation | ✅ Completed |
| Phase 2 — Google Books migration | ✅ Code completed; activation steps remain |
| Phase 3 — Guided add-book flow | ✅ Completed |
| Phase 4 — Library dashboard | ✅ Completed |
| Phase 5 — Book details and editing | ✅ Code completed; database migration must be activated |
| Phase 6 — Analytics | ✅ Code completed; database migration must be activated |
| Phase 7 — Authentication, navigation, and accessibility | ✅ Completed |
| Phase 8 — Performance and final QA | ✅ Completed |

## Important activation requirements

The Google Books integration requires:

1. Add `GOOGLE_BOOKS_API_KEY` to the local `.env` file and deployed environment.
2. Run the additive PostgreSQL migration:

   ```bash
   npm run migrate:google-books
   ```

The migration file is:

```text
migrations/001_google_books_metadata.sql
```

Do not expose the Google Books API key in browser JavaScript or HTML.

The Phase 5 reversible-deletion flow also requires:

```bash
npm run migrate:soft-delete
```

The additive migration file is:

```text
migrations/002_soft_delete_books.sql
```

The Phase 6 persistent reading goal requires:

```bash
npm run migrate:analytics
```

The additive migration file is:

```text
migrations/003_reading_goal.sql
```

Do not run these migrations against a live database without authorization and a current backup.

---

## Phase 0 — Stabilization

**Status: ✅ Completed**

### Goals

- Fix reliability issues before redesigning the application.
- Ensure CRUD, authentication, metrics, and error states behave predictably.

### Completed work

- Fixed the malformed edit-book SQL query.
- Corrected average ratings to exclude unrated books.
- Prevented unrated books from becoming the highest-rated title.
- Removed the unfinished Favorites navigation link.
- Added friendly 404 and 500 pages.
- Replaced raw login failures with a safe message.
- Fixed logout’s missing `next` parameter.
- Fixed authentication middleware intercepting unknown URLs.
- Added centralized Express error handling.
- Made `app.js` importable without automatically starting the server.
- Added a Phase 0 QA checklist.

### Acceptance criteria

- Adding, viewing, editing, and deleting books works.
- Authentication redirects behave correctly.
- Unknown URLs show a 404 page.
- Unexpected failures show a safe 500 page.
- Library statistics are accurate.

---

## Phase 1 — Shared UI foundation

**Status: ✅ Completed**

### Goals

- Establish one design system and shared component layer.
- Remove inconsistent Bootstrap-only presentation across pages.

### Completed work

- Expanded semantic design tokens for color, spacing, radius, shadows, and motion.
- Added consistent surfaces, forms, buttons, alerts, focus states, and disabled states.
- Added reusable EJS partials for:

  - Page headers
  - Form fields
  - Alerts
  - Empty states
  - Book covers
  - Confirmation dialogs

- Standardized authentication, discovery, add/edit, details, and analytics layouts.
- Added page-specific browser titles.
- Applied the saved theme before rendering to prevent light-theme flashing.
- Synchronized theme icons and accessible labels.
- Improved logged-in and logged-out navigation.
- Added reduced-motion support.
- Added responsive mobile form and navigation behavior.

### Acceptance criteria

- Shared components are used instead of duplicated markup.
- Light and dark themes render consistently.
- Forms and controls have visible keyboard focus.
- Mobile layouts have no horizontal overflow.

---

## Phase 2 — Google Books migration

**Status: ✅ Code completed; API key and database migration must be activated**

### Goals

- Replace Open Library with Google Books.
- Normalize external metadata before it enters the application.
- Keep API credentials server-side.

### Completed work

- Removed Open Library code and references.
- Added a dedicated server-side Google Books service.
- Added normalized endpoints:

  ```text
  GET /api/google-books/search
  GET /api/google-books/:volumeId
  ```

- Normalized:

  - Google volume ID
  - Title and subtitle
  - Authors
  - ISBN-10 and ISBN-13
  - Publisher
  - Published date and year
  - Description
  - Page count
  - Categories
  - Language
  - HTTPS cover URL

- Added response timeouts and safe API failure responses.
- Added an additive PostgreSQL migration.
- Added a migration runner:

  ```bash
  npm run migrate:google-books
  ```

- Added `.env.example`.
- Added Google Books adapter tests.
- Updated relevant documentation and UI metadata display.

### Remaining activation work

- Configure `GOOGLE_BOOKS_API_KEY`.
- Run the PostgreSQL migration.
- Perform one live Google Books search after configuration.

### Acceptance criteria

- Search results come from Google Books.
- The API key never reaches the browser.
- Sparse Google metadata does not break rendering.
- Existing and manually entered books remain compatible.

---

## Phase 3 — Guided add-book flow

**Status: ✅ Completed**

### Goals

- Replace the disconnected search-to-form experience with one guided flow.
- Remove the `selectedBook` local-storage handoff.

### Completed work

- Added a single-page three-step experience:

  1. Find a book
  2. Review metadata
  3. Add reading details

- Added Google Books search modes for:

  - Everything
  - Title
  - Author
  - ISBN

- Added loading skeletons.
- Added no-results and API-error states.
- Added result pagination.
- Added editable imported metadata.
- Added manual entry.
- Added duplicate detection using Google volume ID or ISBN.
- Added links to existing duplicate books.
- Added server-side Google volume verification before saving.
- Added save-button loading feedback.
- Redirected successful additions to the new book’s details page.
- Redirected `/add` to manual entry in the unified flow.
- Removed `views/add.ejs` and the old local-storage flow.

### Acceptance criteria

- A user can search, select, edit, and save a Google Books result.
- A user can add a book manually.
- Duplicate books are clearly identified.
- The experience works by keyboard and on mobile.

---

## Phase 4 — Library dashboard

**Status: ✅ Completed**

### Goals

- Make the user’s collection the primary content.
- Improve finding, sorting, filtering, and managing books.

### Completed work

- Replaced the oversized returning-user hero with a compact overview.
- Kept a larger onboarding hero for empty libraries.
- Ensured overview metrics always use the complete library.
- Added server-side pagination.
- Added search by title, author, or ISBN.
- Added sorting by:

  - Recently added
  - Recently read
  - Highest rated
  - Title A–Z
  - Author A–Z

- Added rated/unrated filtering.
- Added reading-year filtering.
- Preserved query parameters across pagination.
- Added clear-search and clear-filter actions.
- Added accurate result ranges and counts.
- Added debounced autocomplete with:

  - Loading feedback
  - Request cancellation
  - Match highlighting
  - Arrow-key navigation
  - Enter selection
  - Escape dismissal

- Added card metadata for reading date or publication year.
- Displayed ratings as `x/10`.
- Added lazy-loaded covers and missing-cover fallbacks.
- Moved card management actions into accessible overflow menus.
- Added separate empty-library and no-results states.

### Acceptance criteria

- Filters, search, sorting, and pagination work together.
- URLs preserve the current library view.
- Card actions work on desktop and mobile.
- Autocomplete is keyboard accessible.

---

## Phase 5 — Book details and editing

**Status: ✅ Code completed; soft-delete migration must be activated**

### Goals

- Make the book details page the primary management screen.
- Make destructive actions safer.

### Completed work

- Refined the book details information hierarchy with prominent reader actions.
- Displayed Google metadata consistently:

  - Subtitle
  - Publisher
  - Published date
  - Page count
  - Categories
  - Language
  - Description

- Improved notes, review, and description typography.
- Preserved paragraph breaks in reader-authored content.
- Added clear Edit and Delete actions.
- Added an accessible delete confirmation that names the book and explains Undo.
- Added additive soft deletion with an active-book index.
- Added an Undo notification after deletion.
- Reused grouped form sections in Edit.
- Added a read-only Google Books metadata summary to Edit.
- Kept imported Google metadata out of the update mutation.
- Added accessible success feedback after updates and restores.
- Applied active-book filtering to library, analytics, autocomplete, duplicates, details, and editing.
- Verified ownership constraints for view, edit, update, delete, and restore actions.
- Added automated coverage for soft-delete filtering and cross-user access.
- Completed browser QA at desktop and 390px mobile widths, including keyboard dialog dismissal, Undo, update feedback, light/dark themes, and overflow checks.

### Remaining activation work

- Run the additive soft-delete migration:

  ```bash
  npm run migrate:soft-delete
  ```

### Acceptance criteria

- Book metadata and reader content are easy to scan.
- Editing does not accidentally remove imported metadata.
- Deletion can be undone temporarily.
- All actions work by keyboard and on mobile.

---

## Phase 6 — Analytics

**Status: ✅ Code completed; reading-goal migration must be activated**

### Goals

- Turn the analytics page into useful reading insights.

### Completed work

- Kept unrated books excluded from rating averages.
- Added a 1–10 rating-distribution chart.
- Added books-read-by-month data for the current year.
- Added books-read-this-year summary data.
- Added a persistent, editable yearly reading goal with progress.
- Added highest-rated books.
- Added most-read authors based on completed books.
- Added recent reading activity.
- Replaced generic chart labels with question-oriented titles.
- Added dedicated empty states for empty libraries, missing ratings, missing dates, authors, favorites, and activity.
- Made charts responsive and synchronized them with light/dark theme changes.
- Added always-available screen-reader summaries and expandable visible data summaries for both charts.
- Added timezone-safe handling for PostgreSQL date strings and JavaScript date objects.
- Added automated analytics coverage for aggregation, unrated averages, empty data, goal overachievement, and date parsing.
- Completed browser QA at desktop and 390px mobile widths, including goal updates, empty and sparse data, theme switching, chart sizing, accessible names, overflow, and console errors.

### Remaining activation work

- Run the additive analytics migration:

  ```bash
  npm run migrate:analytics
  ```

### Acceptance criteria

- Every visualization answers a useful reading question.
- Empty libraries and missing rating/date data are handled clearly.
- Charts remain usable on mobile and in dark mode.

---

## Phase 7 — Authentication, navigation, and accessibility

**Status: ✅ Completed**

### Goals

- Polish authentication and navigation.
- Complete an accessibility pass across the application.

### Planned work

- Finalize navigation labels and active states.
- Ensure mobile navigation remains compact and reachable.
- Add inline registration errors.
- Preserve submitted registration values after errors.
- Handle duplicate email registration safely.
- Add password requirements.
- Add show/hide-password controls.
- Add suitable `autocomplete` attributes.
- Confirm every form label is associated with its control.
- Add accessible names to every icon-only button.
- Verify menus, dialogs, search results, and forms by keyboard.
- Verify color contrast in both themes.
- Test reduced-motion behavior.
- Add meaningful success announcements and error focus management.

### Acceptance criteria

- Core flows can be completed without a mouse.
- Authentication errors do not expose technical details.
- Mobile navigation and forms are comfortable to use.
- Automated and manual accessibility checks pass.

---

## Phase 8 — Performance and final QA

**Status: ✅ Completed**

### Goals

- Harden the application for larger libraries and unreliable external services.
- Perform the final regression and release-readiness pass.

### Planned work

- Add short-lived caching for repeated Google Books searches.
- Cancel stale Google Books requests.
- Continue using partial Google API responses.
- Lazy-load covers throughout the application.
- Prevent duplicate form submissions.
- Add image loading-error fallbacks.
- Test Google Books timeouts, quota errors, and missing metadata.
- Test database failures.
- Test light mode, dark mode, keyboard-only use, and reduced motion.
- Test common mobile, tablet, and desktop breakpoints.
- Remove unused CSS and obsolete code.
- Add or expand route and service tests.
- Run the complete manual QA checklist.
- Update screenshots and deployment documentation.

### Acceptance criteria

- Primary flows remain usable during recoverable API failures.
- There are no known horizontal-overflow or theme regressions.
- Tests and manual QA pass.
- Deployment variables and migrations are documented.

---

## Recommended continuation order

Continue sequentially:

1. Phase 7 — Authentication, navigation, and accessibility
2. Phase 8 — Performance and final QA

Before Phase 7, activate any outstanding Phase 2 requirements and the Phase 5 and Phase 6 migrations.

## Prompt for a new chat

Copy the following prompt into a new chat:

```text
Read docs/ui-ux-implementation-plan.md and inspect the current BookVault repository.

Phases 0 through 6 have been implemented. Continue with Phase 7 only. Preserve existing work and unrelated changes, implement the phase completely, verify it with appropriate tests and browser QA, and update the plan document when finished.

Before implementation, check whether GOOGLE_BOOKS_API_KEY is configured and whether migrations/001_google_books_metadata.sql, migrations/002_soft_delete_books.sql, and migrations/003_reading_goal.sql have been applied. Do not expose secrets or modify the live database without appropriate authorization.
```
