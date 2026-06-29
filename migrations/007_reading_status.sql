-- Phase 12: Reading Status

ALTER TABLE books
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'read';

UPDATE books SET status = 'read' WHERE status IS NULL;

CREATE INDEX IF NOT EXISTS idx_books_status ON books(status);
