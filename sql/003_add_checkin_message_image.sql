-- backend/sql/003_add_checkin_message_image.sql

ALTER TABLE checkins
  ADD COLUMN IF NOT EXISTS message TEXT;

ALTER TABLE checkins
  ADD COLUMN IF NOT EXISTS image_url TEXT;
