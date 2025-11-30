-- backend/005_create_gamification_tables.sql

-- Achievements: Definition
CREATE TABLE IF NOT EXISTS achievements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Achievements pro User
CREATE TABLE IF NOT EXISTS user_achievements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  achievement_id INTEGER NOT NULL,
  unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, achievement_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (achievement_id) REFERENCES achievements(id)
);

-- Missions: Definition
-- target_type z.B.:
--  - TOTAL_CHECKINS
--  - STREAK_DAYS
CREATE TABLE IF NOT EXISTS missions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  target_type TEXT NOT NULL,
  target_value INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Missions pro User + Fortschritt
CREATE TABLE IF NOT EXISTS user_missions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  mission_id INTEGER NOT NULL,
  progress_value INTEGER NOT NULL DEFAULT 0,
  completed_at DATETIME,
  UNIQUE (user_id, mission_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (mission_id) REFERENCES missions(id)
);
