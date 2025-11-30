-- backend/sql/004_create_friendships.sql

-- Einfache Freundschafts-Tabelle.
-- Für SQLite kannst du SERIAL durch INTEGER PRIMARY KEY AUTOINCREMENT ersetzen.

CREATE TABLE IF NOT EXISTS friendships (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  friend_id INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'accepted',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Optional: einfache Unique-Constraint, damit eine Freundschaft nur einmal existiert
CREATE UNIQUE INDEX IF NOT EXISTS idx_friendships_pair
  ON friendships (user_id, friend_id);
