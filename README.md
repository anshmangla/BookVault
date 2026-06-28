# BookVault

BookVault is a full-stack personal reading library for discovering books, recording reading history, writing notes and reviews, and exploring reading analytics.

It uses the Google Books API for normalized book metadata while keeping API credentials on the server. Each authenticated user receives a private library stored in PostgreSQL.

## Links

- [Live application](https://bookvault-elmm.onrender.com/)
- [GitHub repository](https://github.com/anshmangla/BookVault)

The deployed environment must have the variables and database migrations described below.

## Features

### Guided book discovery

- Search Google Books by title, author, ISBN, or a general query.
- Review and edit imported metadata before saving.
- Add books manually when an external result is unavailable.
- Import titles, subtitles, authors, ISBNs, publishers, publication dates, descriptions, page counts, categories, languages, and cover images.
- Detect likely duplicates using Google volume IDs and ISBNs.
- Handle sparse metadata, missing covers, API errors, and empty results.
- Cache repeated Google Books searches and volume lookups for five minutes.

### Library dashboard

- Search the personal library by title, author, or ISBN.
- Sort by recently added, recently read, rating, title, or author.
- Filter by rating status and reading year.
- Combine search, sorting, filtering, and server-side pagination.
- Use keyboard-accessible autocomplete and card action menus.
- View collection-wide totals, average rating, and the highest-rated book.

### Book details and editing

- Display imported Google metadata separately from reader-owned information.
- Record a 1–10 rating, date read, private notes, and a review.
- Preserve paragraph breaks in notes and reviews.
- Keep imported metadata intact when editing reading details.
- Soft-delete books through a confirmation dialog.
- Restore a deleted book using the Undo notification.
- Restrict viewing, editing, deleting, and restoring to the owning user.

### Reading analytics

- Total books and rated-book average.
- Books read during the current year.
- Editable annual reading goal and progress.
- Rating-distribution chart.
- Books-read-by-month chart.
- Highest-rated books.
- Most-read authors.
- Recent reading activity.
- Dedicated states for empty libraries and missing rating, author, or reading-date data.
- Screen-reader text summaries for chart data.

### Authentication and accessibility

- Email/password registration and login with bcrypt password hashing.
- Optional Google OAuth login.
- Friendly duplicate-email and invalid-login errors.
- Preserved form values after validation errors.
- Password requirements and show/hide password controls.
- Responsive keyboard-accessible navigation, forms, menus, dialogs, and search results.
- Visible focus states, accessible labels, announcements, and error focus management.
- Light and dark themes with saved preferences.
- Reduced-motion support.

### Reliability and performance

- Friendly 404 and 500 pages.
- Centralized Express error handling.
- Server-side Google Books timeouts and normalized failure responses.
- Request cancellation for stale discovery and autocomplete requests.
- Duplicate-submission protection.
- Lazy-loaded covers with missing-image fallbacks.
- Responsive layouts for mobile, tablet, and desktop.

## Technology

| Layer | Technology |
|---|---|
| Server | Node.js, Express 5 |
| Views | EJS, HTML, CSS, Bootstrap 5, JavaScript |
| Database | PostgreSQL |
| Authentication | Express Session, Passport, Google OAuth, bcrypt |
| External data | Google Books API via Axios |
| Charts | Chart.js |
| Tests | Node.js test runner |
| Deployment | Render and Neon PostgreSQL |

## Architecture

```text
Browser
  |
  |-- server-rendered EJS pages
  |-- normalized /api/google-books endpoints
  |
Express application
  |-- authentication and ownership checks
  |-- library query and analytics services
  |-- Google Books adapter and cache
  |
  |-- PostgreSQL
  `-- Google Books API
```

The Google Books API key is used only by the Express server. It is never embedded in browser JavaScript or HTML.

## Project structure

```text
BookVault/
|-- config/                 Passport configuration
|-- docs/                   QA, migration, and implementation notes
|-- middleware/             Authentication middleware
|-- migrations/             Additive PostgreSQL migrations
|-- public/
|   |-- css/                Design system and page styles
|   `-- js/                 Authentication and form behavior
|-- routes/                 Authentication and book routes
|-- scripts/                Database migration runners
|-- services/               Google Books, library-query, and analytics logic
|-- tests/                  Automated tests
|-- views/
|   `-- partials/           Shared EJS components
|-- app.js                  Express application entry point
|-- db.js                   PostgreSQL connection pool
`-- package.json
```

## Local setup

### Prerequisites

- Node.js 20 or newer
- npm
- PostgreSQL database
- Google Books API key
- Google OAuth credentials if Google login is enabled

### 1. Clone and install

```bash
git clone https://github.com/anshmangla/BookVault.git
cd BookVault
npm install
```

### 2. Configure environment variables

Copy `.env.example` to `.env` and replace the placeholder values:

```env
DATABASE_URL=postgresql://username:password@host/database
SESSION_SECRET=replace-with-a-long-random-value
PORT=3000

GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback

GOOGLE_BOOKS_API_KEY=your-google-books-api-key
```

Never commit `.env` or expose these values in client-side code.

### 3. Prepare the database

BookVault expects existing `users` and `books` tables. The repository migrations are additive upgrades for the current application:

```bash
npm run migrate:google-books
npm run migrate:soft-delete
npm run migrate:analytics
```

Run migrations in numeric order:

| Migration | Purpose |
|---|---|
| `001_google_books_metadata.sql` | Adds normalized Google Books metadata and its lookup index |
| `002_soft_delete_books.sql` | Adds reversible deletion and an active-library index |
| `003_reading_goal.sql` | Adds each user’s persistent annual reading goal |

Back up production data and obtain authorization before running migrations against a live database.

The current schema includes:

- `users`: account identity, local or Google authentication data, and reading goal.
- `books`: owner, book identity, Google metadata, cover, rating, reading date, notes, review, timestamps, and soft-deletion state.

### 4. Start BookVault

Development:

```bash
npm run dev
```

Production:

```bash
npm start
```

Open [http://localhost:3000](http://localhost:3000).

## Available scripts

| Command | Description |
|---|---|
| `npm start` | Starts the production server |
| `npm run dev` | Starts the server with Nodemon |
| `npm test` | Runs the complete automated test suite |
| `npm run migrate:google-books` | Applies migration 001 |
| `npm run migrate:soft-delete` | Applies migration 002 |
| `npm run migrate:analytics` | Applies migration 003 |

## Server API

Authenticated browser requests use normalized server endpoints:

```http
GET /api/google-books/search?q=earthsea&searchBy=title
GET /api/google-books/:volumeId
GET /api/search-books?q=earthsea
```

Supported Google Books search modes are `all`, `title`, `author`, and `isbn`. Pagination uses `startIndex` and `maxResults`.

## Testing and QA

Run all automated tests:

```bash
npm test
```

Coverage includes:

- Google Books normalization, sparse records, search modes, pagination, and missing credentials.
- Library query normalization and soft-delete filtering.
- Cross-user authorization for viewing, updating, deleting, and restoring books.
- Analytics aggregation, unrated averages, goals, empty data, and date handling.

Manual QA guidance is available in:

- [`docs/phase-0-qa.md`](docs/phase-0-qa.md)
- [`docs/ui-ux-implementation-plan.md`](docs/ui-ux-implementation-plan.md)
- [`docs/google-books-migration.md`](docs/google-books-migration.md)

## Deployment checklist

- Configure every required environment variable.
- Use a long, random `SESSION_SECRET`.
- Set the production Google OAuth callback URL.
- Apply migrations 001–003 in order.
- Confirm the Google Books key is absent from browser responses.
- Verify registration, login, CRUD, Undo, search, analytics, mobile layout, keyboard navigation, and both themes.
- Configure database backups and application monitoring.

## Potential next steps

- Reading statuses, progress, re-reads, and custom shelves.
- Tags, favorites, series tracking, and lending status.
- Goodreads or StoryGraph import and CSV/JSON export.
- Quotes, annotations, and Markdown export.
- Installable PWA support and ISBN scanning.
- Optional semantic search and explainable recommendations.

## Author

**Ansh Mangla**

B.Tech in Artificial Intelligence and Machine Learning

- [GitHub](https://github.com/anshmangla)
- [LinkedIn](https://linkedin.com/in/anshmangla)

## License

This project is currently provided for educational and portfolio purposes. Add an explicit license file before distributing it under a standard open-source license.
