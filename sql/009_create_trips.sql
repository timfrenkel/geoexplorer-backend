-- backend/sql/007_create_trips.sql
-- Tabellen für Trips und die Zuordnung von Locations zu Trips.

CREATE TABLE IF NOT EXISTS trips (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  start_date DATE,
  end_date DATE,
  is_public BOOLEAN NOT NULL DEFAULT true,
  cover_image_url TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- OPTIONALE INDEXE
CREATE INDEX IF NOT EXISTS idx_trips_user_id
  ON trips (user_id);

CREATE INDEX IF NOT EXISTS idx_trips_is_public
  ON trips (is_public);

CREATE TABLE IF NOT EXISTS trip_locations (
  id SERIAL PRIMARY KEY,
  trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  location_id INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  note TEXT,
  day_index INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_trip_locations_trip_id
  ON trip_locations (trip_id);

CREATE INDEX IF NOT EXISTS idx_trip_locations_location_id
  ON trip_locations (location_id);
