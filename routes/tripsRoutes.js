// backend/routes/tripsRoutes.js
const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// Alle eigenen Trips
router.get('/trips', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        id,
        user_id,
        name,
        description,
        start_date,
        end_date,
        is_public,
        cover_image_url,
        created_at,
        updated_at
      FROM trips
      WHERE user_id = $1
      ORDER BY created_at DESC
      `,
      [req.user.id]
    );

    res.json({ trips: result.rows });
  } catch (err) {
    console.error('Get trips error:', err);
    res.status(500).json({ message: 'Fehler beim Laden der Trips.' });
  }
});

// Einzelner Trip (eigener oder öffentlicher)
router.get('/trips/:id', authMiddleware, async (req, res) => {
  const tripId = parseInt(req.params.id, 10);

  try {
    const tripRes = await pool.query(
      `
      SELECT
        t.id,
        t.user_id,
        t.name,
        t.description,
        t.start_date,
        t.end_date,
        t.is_public,
        t.cover_image_url,
        t.created_at,
        t.updated_at
      FROM trips t
      WHERE
        t.id = $1
        AND (t.user_id = $2 OR t.is_public = TRUE)
      `,
      [tripId, req.user.id]
    );

    if (tripRes.rowCount === 0) {
      return res.status(404).json({ message: 'Trip nicht gefunden.' });
    }

    const trip = tripRes.rows[0];

    const locationsRes = await pool.query(
      `
      SELECT
        tl.id,
        tl.location_id,
        tl.note,
        tl.day_index,
        tl.created_at,

        l.name AS location_name,
        l.image_url AS location_image,
        l.latitude,
        l.longitude,
        l.category
      FROM trip_locations tl
      JOIN locations l ON l.id = tl.location_id
      WHERE tl.trip_id = $1
      ORDER BY tl.day_index, tl.id
      `,
      [tripId]
    );

    res.json({
      trip,
      locations: locationsRes.rows
    });
  } catch (err) {
    console.error('Get trip detail error:', err);
    res.status(500).json({ message: 'Fehler beim Laden des Trips.' });
  }
});

// Trip erstellen
router.post('/trips', authMiddleware, async (req, res) => {
  const {
    name,
    description,
    startDate,
    endDate,
    isPublic,
    coverImageUrl
  } = req.body || {};

  if (!name) {
    return res.status(400).json({ message: 'Name des Trips ist erforderlich.' });
  }

  try {
    const insertRes = await pool.query(
      `
      INSERT INTO trips (
        user_id,
        name,
        description,
        start_date,
        end_date,
        is_public,
        cover_image_url
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING
        id,
        user_id,
        name,
        description,
        start_date,
        end_date,
        is_public,
        cover_image_url,
        created_at,
        updated_at
      `,
      [
        req.user.id,
        name,
        description || '',
        startDate || null,
        endDate || null,
        !!isPublic,
        coverImageUrl || null
      ]
    );

    res.status(201).json({ trip: insertRes.rows[0] });
  } catch (err) {
    console.error('Create trip error:', err);
    res.status(500).json({ message: 'Fehler beim Erstellen des Trips.' });
  }
});

// Trip aktualisieren
router.put('/trips/:id', authMiddleware, async (req, res) => {
  const tripId = parseInt(req.params.id, 10);
  const {
    name,
    description,
    startDate,
    endDate,
    isPublic,
    coverImageUrl
  } = req.body || {};

  if (!name) {
    return res.status(400).json({ message: 'Name des Trips ist erforderlich.' });
  }

  try {
    // Besitz prüfen
    const ownerRes = await pool.query(
      'SELECT user_id FROM trips WHERE id = $1',
      [tripId]
    );
    if (ownerRes.rowCount === 0) {
      return res.status(404).json({ message: 'Trip nicht gefunden.' });
    }
    if (ownerRes.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ message: 'Du darfst diesen Trip nicht bearbeiten.' });
    }

    const updateRes = await pool.query(
      `
      UPDATE trips
      SET
        name = $1,
        description = $2,
        start_date = $3,
        end_date = $4,
        is_public = $5,
        cover_image_url = $6,
        updated_at = NOW()
      WHERE id = $7
      RETURNING
        id,
        user_id,
        name,
        description,
        start_date,
        end_date,
        is_public,
        cover_image_url,
        created_at,
        updated_at
      `,
      [
        name,
        description || '',
        startDate || null,
        endDate || null,
        !!isPublic,
        coverImageUrl || null,
        tripId
      ]
    );

    res.json({ trip: updateRes.rows[0] });
  } catch (err) {
    console.error('Update trip error:', err);
    res.status(500).json({ message: 'Fehler beim Aktualisieren des Trips.' });
  }
});

// Trip löschen
router.delete('/trips/:id', authMiddleware, async (req, res) => {
  const tripId = parseInt(req.params.id, 10);

  try {
    // Besitz prüfen
    const ownerRes = await pool.query(
      'SELECT user_id FROM trips WHERE id = $1',
      [tripId]
    );
    if (ownerRes.rowCount === 0) {
      return res.status(404).json({ message: 'Trip nicht gefunden.' });
    }
    if (ownerRes.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ message: 'Du darfst diesen Trip nicht löschen.' });
    }

    await pool.query('DELETE FROM trips WHERE id = $1', [tripId]);

    res.json({ message: 'Trip gelöscht.' });
  } catch (err) {
    console.error('Delete trip error:', err);
    res.status(500).json({ message: 'Fehler beim Löschen des Trips.' });
  }
});

// Location zu Trip hinzufügen
router.post('/trips/:id/locations', authMiddleware, async (req, res) => {
  const tripId = parseInt(req.params.id, 10);
  const { locationId, note, dayIndex } = req.body || {};

  if (!locationId) {
    return res.status(400).json({ message: 'locationId ist erforderlich.' });
  }

  try {
    // Besitz prüfen
    const ownerRes = await pool.query(
      'SELECT user_id FROM trips WHERE id = $1',
      [tripId]
    );
    if (ownerRes.rowCount === 0) {
      return res.status(404).json({ message: 'Trip nicht gefunden.' });
    }
    if (ownerRes.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ message: 'Du darfst diesen Trip nicht bearbeiten.' });
    }

    const insertRes = await pool.query(
      `
      INSERT INTO trip_locations (
        trip_id,
        location_id,
        note,
        day_index
      )
      VALUES ($1, $2, $3, $4)
      RETURNING
        id,
        trip_id,
        location_id,
        note,
        day_index,
        created_at
      `,
      [tripId, locationId, note || '', dayIndex || null]
    );

    res.status(201).json({ tripLocation: insertRes.rows[0] });
  } catch (err) {
    console.error('Add trip location error:', err);
    res
      .status(500)
      .json({ message: 'Fehler beim Hinzufügen des Ortes zum Trip.' });
  }
});

// Location aus Trip entfernen
router.delete(
  '/trips/:tripId/locations/:tripLocationId',
  authMiddleware,
  async (req, res) => {
    const tripId = parseInt(req.params.tripId, 10);
    const tripLocationId = parseInt(req.params.tripLocationId, 10);

    try {
      // Besitz prüfen
      const ownerRes = await pool.query(
        'SELECT user_id FROM trips WHERE id = $1',
        [tripId]
      );
      if (ownerRes.rowCount === 0) {
        return res.status(404).json({ message: 'Trip nicht gefunden.' });
      }
      if (ownerRes.rows[0].user_id !== req.user.id) {
        return res
          .status(403)
          .json({ message: 'Du darfst diesen Trip nicht bearbeiten.' });
      }

      await pool.query(
        'DELETE FROM trip_locations WHERE id = $1 AND trip_id = $2',
        [tripLocationId, tripId]
      );

      res.json({ message: 'Ort aus Trip entfernt.' });
    } catch (err) {
      console.error('Delete trip location error:', err);
      res
        .status(500)
        .json({ message: 'Fehler beim Entfernen des Ortes aus dem Trip.' });
    }
  }
);

module.exports = router;
