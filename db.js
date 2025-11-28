// backend/db.js
const { Pool } = require('pg');
require('dotenv').config();

if (!process.env.DATABASE_URL) {
  console.warn('Warnung: DATABASE_URL ist nicht gesetzt. PostgreSQL-Verbindung wird fehlschlagen.');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'false'
    ? false
    : { rejectUnauthorized: false } // für Render typisch
});

pool.connect()
  .then(() => console.log('PostgreSQL verbunden.'))
  .catch((err) => console.error('PostgreSQL Verbindungsfehler:', err));

module.exports = pool;
