-- backend/006_seed_gamification.sql

-- Basis-Achievements
INSERT OR IGNORE INTO achievements (code, name, description, icon)
VALUES
  ('FIRST_CHECKIN', 'Erster Check-in', 'Du hast deinen ersten Ort besucht.', '✨'),
  ('CHECKINS_5',    '5 Orte besucht', 'Du hast an 5 verschiedenen Orten eingecheckt.', '🖐️'),
  ('CHECKINS_10',   '10 Orte besucht', 'Du bist richtig unterwegs – 10 Check-ins!', '🔟'),
  ('STREAK_3',      '3-Tage-Streak', 'Du warst 3 Tage in Folge aktiv.', '🔥'),
  ('STREAK_7',      '7-Tage-Streak', 'Eine ganze Woche ohne Pause unterwegs!', '🔥');

-- Basis-Missions
INSERT OR IGNORE INTO missions (code, name, description, target_type, target_value)
VALUES
  ('MISSION_TOTAL_5',  '5 Orte entdecken',  'Mache insgesamt 5 Check-ins.', 'TOTAL_CHECKINS', 5),
  ('MISSION_TOTAL_10', '10 Orte entdecken', 'Mache insgesamt 10 Check-ins.', 'TOTAL_CHECKINS', 10),
  ('MISSION_STREAK_3', '3 Tage in Folge',   'Halte eine 3-tägige Check-in-Streak.', 'STREAK_DAYS', 3);
