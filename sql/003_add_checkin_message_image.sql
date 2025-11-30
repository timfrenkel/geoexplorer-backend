-- backend/sql/003_add_checkin_message_image.sql

-- Fügt optionale Text- und Bildfelder zu bestehenden Check-ins hinzu.
-- Falls deine Datenbank kein IF NOT EXISTS unterstützt, kannst du die
-- EXISTS-Abfragen weg lassen und die ALTER TABLEs direkt ausführen.

-- Beispiel für PostgreSQL / SQLite (einfacher Ansatz ohne IF NOT EXISTS):

ALTER TABLE checkins
  ADD COLUMN message TEXT;

ALTER TABLE checkins
  ADD COLUMN image_url TEXT;
