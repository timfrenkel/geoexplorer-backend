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
const tripsRoutes = require('./routes/tripsRoutes');
const gamificationRoutes = require('./routes/gamificationRoutes');

const app = express();
const PORT = process.env.PORT || 4000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

app.use(
  cors({
    origin: CORS_ORIGIN,
    credentials: true
  })
);

app.use(express.json());
app.use(morgan('dev'));

// Datenbank-Schema initialisieren (Basis-init.sql; weitere Patches hast du bereits separat ausgeführt)
async function initDb() {
  try {
    const sqlPath = path.join(__dirname, 'sql', 'init.sql');
    if (fs.existsSync(sqlPath)) {
      const initSql = fs.readFileSync(sqlPath, 'utf8');
      await pool.query(initSql);
      console.log('PostgreSQL-Basisschema initialisiert.');
    }
  } catch (err) {
    console.error('Fehler bei DB-Init:', err);
  }
}

initDb();

// API-Routen
app.use('/api/auth', authRoutes);
app.use('/api', locationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', feedRoutes);
app.use('/api', friendsRoutes);
app.use('/api', tripsRoutes);
app.use('/api', gamificationRoutes);

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
