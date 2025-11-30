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

app.use(
  cors({
    origin: CORS_ORIGIN,
    credentials: true
  })
);

app.use(express.json());
app.use(morgan('dev'));

// Init DB
async function initDb() {
  try {
    const sqlPath = path.join(__dirname, 'sql', 'init.sql');
    const initSql = fs.readFileSync(sqlPath, 'utf8');
    await pool.query(initSql);
    console.log('PostgreSQL Schema initialisiert.');
  } catch (err) {
    console.error('Init error:', err);
  }
}

initDb();

// ROUTES
app.use('/api/auth', authRoutes);
app.use('/api', locationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', feedRoutes);
app.use('/api', friendsRoutes);

// Health
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Error fallback
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ message: 'Interner Serverfehler.' });
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
