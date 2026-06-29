-- Phase 9: Favorites, Tags & Spoiler Reviews
-- Additive migration only — safe to run on existing data.

-- Favorites flag on books
ALTER TABLE books ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN NOT NULL DEFAULT FALSE;

-- Spoiler flag on books
ALTER TABLE books ADD COLUMN IF NOT EXISTS has_spoilers BOOLEAN NOT NULL DEFAULT FALSE;

-- User-scoped tags
CREATE TABLE IF NOT EXISTS tags (
  id      SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name    VARCHAR(64) NOT NULL,
  UNIQUE (user_id, name)
);

-- Many-to-many book ↔ tag link
CREATE TABLE IF NOT EXISTS book_tags (
  book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  tag_id  INTEGER NOT NULL REFERENCES tags(id)  ON DELETE CASCADE,
  PRIMARY KEY (book_id, tag_id)
);

-- Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_tags_user_id       ON tags(user_id);
CREATE INDEX IF NOT EXISTS idx_book_tags_book_id  ON book_tags(book_id);
CREATE INDEX IF NOT EXISTS idx_book_tags_tag_id   ON book_tags(tag_id);
