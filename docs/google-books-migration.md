# Google Books Migration

## Configuration

1. Enable the Books API in a Google Cloud project.
2. Create an API key and restrict it to the Books API.
3. Add the key to the local and deployed environments:

   ```env
   GOOGLE_BOOKS_API_KEY=your-google-books-api-key
   ```

The key is used only by the Express server. It is never included in browser JavaScript or HTML.
Book search remains unavailable until this variable is configured.

## Database migration

Run the migration against the same PostgreSQL database configured by `DATABASE_URL`:

```bash
npm run migrate:google-books
```

Alternatively, run the SQL directly:

```bash
psql "$DATABASE_URL" -f migrations/001_google_books_metadata.sql
```

The migration is additive and keeps all existing BookVault records compatible.

## Server endpoints

- `GET /api/google-books/search?q=...`
- `GET /api/google-books/:volumeId`

Search supports `startIndex`, `maxResults`, and `searchBy`. `searchBy` accepts `all`, `title`, `author`, or `isbn`. `maxResults` is limited to the Google Books maximum of 40.

## Stored metadata

New Google Books records can store:

- Google volume ID
- Subtitle
- Publisher
- Full published date
- Description
- Page count
- Categories
- Language

Existing `title`, `author`, `isbn`, `publish_year`, and `cover_url` fields remain in use so older and manually entered books continue to work.
