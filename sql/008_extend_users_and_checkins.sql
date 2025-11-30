-- backend/sql/006_extend_users_and_checkins.sql
-- Erweiterung der users- und checkins-Tabelle um Profil- und Gamification-Felder.

-- USER-PROFILFELDER
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS profile_image_url TEXT;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS banner_image_url TEXT;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS bio TEXT;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS mood_emoji TEXT;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS home_city TEXT;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS home_country TEXT;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS custom_status TEXT;

-- PRIVACY-FLAGS
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_profile_public BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_feed_public BOOLEAN NOT NULL DEFAULT true;

-- STREAK-FELDER
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS last_checkin_date DATE;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS checkin_streak_days INTEGER NOT NULL DEFAULT 0;

-- BADGE-LEVEL DIREKT AM CHECKIN (1 = Standard, später für Upgrades)
ALTER TABLE checkins
  ADD COLUMN IF NOT EXISTS badge_level INTEGER NOT NULL DEFAULT 1;
