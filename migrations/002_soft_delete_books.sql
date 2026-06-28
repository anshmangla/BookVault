BEGIN;

ALTER TABLE books
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS books_user_active_idx
  ON books (user_id, created_at DESC)
  WHERE deleted_at IS NULL;

COMMIT;
