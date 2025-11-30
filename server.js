// backend/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const fs = require('fs');
const path = require('path');

const pool = require('./db');
const authRoutes = require('./routes/authRoutes');
const locationRoutes = require('./routes/locationRoutes');
const adminRoutes = require('./routes/adminRoutes');
const feedRoutes = require('./routes/feedRoutes');
const friendsRoutes = require('./routes/friendsRoutes');

const app = express();
const PORT = process.env.PORT || 4000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

// CORS & JSON
app.use(
  cors({
    origin: CORS_ORIGIN,
    credentials: true
  })
);

app.use(express.json());
app.use(morgan('dev'));

// Helfer: eine SQL-Datei ausführen
async function runSqlFile(filename, label) {
  try {
    const sqlPath = path.join(__dirname, 'sql', filename);
    if (!fs.existsSync(sqlPath)) {
      console.warn(`SQL-Datei ${filename} nicht gefunden – überspringe.`);
      return;
    }
    const sql = fs.readFileSync(sqlPath, 'utf8');
    if (!sql.trim()) {
      console.log(`SQL-Datei ${filename} ist leer – überspringe.`);
      return;
    }
    await pool.query(sql);
    console.log(`${label} ausgeführt (${filename}).`);
  } catch (err) {
    // Beim zweiten Start können "Spalte existiert bereits" etc. vorkommen → nur Warnung
    console.warn(`Warnung beim Ausführen von ${filename}:`, err.message);
  }
}

// DB-Schema initialisieren / migrieren
async function initDb() {
  await runSqlFile('init.sql', 'Basisschema');
  await runSqlFile(
    '003_add_checkin_message_image.sql',
    'Checkins um message/image_url erweitert'
  );
  await runSqlFile(
    '004_create_friendships.sql',
    'Friendships-Tabelle angelegt'
  );
  await runSqlFile(
    '005_normalize_location_categories.sql',
    'Location-Kategorien vereinheitlicht'
  );
}


initDb().catch((err) => {
  console.error('Fehler bei DB-Init:', err);
});

// Routen registrieren
app.use('/api/auth', authRoutes);
app.use('/api', locationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', feedRoutes);
app.use('/api', friendsRoutes);

// Healthcheck
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Fallback Fehlerhandler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ message: 'Interner Serverfehler.' });
});

app.listen(PORT, () => {
  console.log(`Backend läuft auf http://localhost:${PORT}`);
});
