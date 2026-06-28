BEGIN;

ALTER TABLE books
  ADD COLUMN IF NOT EXISTS google_volume_id TEXT,
  ADD COLUMN IF NOT EXISTS subtitle TEXT,
  ADD COLUMN IF NOT EXISTS publisher TEXT,
  ADD COLUMN IF NOT EXISTS published_date TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS page_count INTEGER,
  ADD COLUMN IF NOT EXISTS categories TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS language VARCHAR(16);

CREATE INDEX IF NOT EXISTS books_user_google_volume_idx
  ON books (user_id, google_volume_id)
  WHERE google_volume_id IS NOT NULL;

COMMIT;
