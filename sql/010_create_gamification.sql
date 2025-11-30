-- backend/sql/008_create_gamification.sql
-- Grundtabellen für Missionen, Achievements und User-Fortschritt.

-- MISSIONS: Definition einzelner Missionen
CREATE TABLE IF NOT EXISTS missions (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,          -- z.B. "daily_first_checkin"
  name TEXT NOT NULL,                 -- Anzeigename
  description TEXT,                   -- Erklärung
  target_type TEXT NOT NULL,          -- z.B. "checkins_per_day", "new_locations"
  target_value INTEGER NOT NULL,      -- z.B. 1, 5, 10...
  is_repeatable BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- USER_MISSIONS: Fortschritt des Users bei einer Mission
CREATE TABLE IF NOT EXISTS user_missions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mission_id INTEGER NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  progress_value INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMP,
  last_updated TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_missions_unique
  ON user_missions (user_id, mission_id);

-- ACHIEVEMENTS: einmalige Erfolge
CREATE TABLE IF NOT EXISTS achievements (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,          -- z.B. "first_checkin", "world_traveler"
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,                          -- z.B. Emoji oder Icon-Name
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- USER_ACHIEVEMENTS: welche Achievements der User besitzt
CREATE TABLE IF NOT EXISTS user_achievements (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_id INTEGER NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_achievements_unique
  ON user_achievements (user_id, achievement_id);
