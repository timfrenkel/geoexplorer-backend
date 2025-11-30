-- backend/sql/005_normalize_location_categories.sql
-- Vereinheitlicht Kategorien für alle vorhandenen Locations.
-- Alte Kategorien (deutsch, sehr fein) -> neue Slugs (für Filter & Auswertung).

-- LANDMARKS: große Wahrzeichen / bedeutende Gebäude
UPDATE locations
SET category = 'landmark'
WHERE category IN (
  'Wahrzeichen',
  'Politik',
  'Schloss',
  'Monument',
  'Rathaus',
  'Stadion',
  'Brücke',
  'Burg',
  'Dom'
);

-- CULTURE: Museen, Kirchen, historische Orte, Kulturstätten
UPDATE locations
SET category = 'culture'
WHERE category IN (
  'Museum',
  'Historisch',
  'Mahnmal',
  'Industriekultur',
  'Oper',
  'Konzerthaus',
  'Kirche'
);

-- URBAN: Plätze, Stadtviertel, Märkte, Einkaufsstraßen, Nightlife, Hafenviertel
UPDATE locations
SET category = 'urban'
WHERE category IN (
  'Platz',
  'Stadtviertel',
  'Altstadt',
  'Markt',
  'Einkaufsstraße',
  'Ausgehviertel',
  'Hafen'
);

-- PARKS: Stadtparks, Gärten
UPDATE locations
SET category = 'park'
WHERE category IN (
  'Park',
  'Garten'
);

-- NATURE: Naturspots, Berge, Schluchten, Wälder, Bergseen, Aussichtspunkte
UPDATE locations
SET category = 'nature'
WHERE category IN (
  'Natur',
  'Schlucht',
  'Bergsee',
  'Wasserfall',
  'Wald',
  'Aussichtspunkt'
);

-- WATER: explizite Wasser-/Küsten-Kategorien (falls du solche Strings verwendest)
UPDATE locations
SET category = 'water'
WHERE category IN (
  'Strand',
  'Ufer',
  'Küste',
  'Meer'
);

-- UNIQUE: Lost Places, besondere / schräge Orte, Ingenieurbauten
UPDATE locations
SET category = 'unique'
WHERE category IN (
  'Lost Place',
  'Besonderer Ort',
  'Ingenieurbau'
);
