const express = require('express');
const { query } = require('../db');

const router = express.Router();

// GET /health : 200 si l'API tourne ET joint la base, 503 sinon.
router.get('/health', async (req, res) => {
  try {
    await query('SELECT 1');
    res.json({ status: 'ok', db: 'ok', uptime: Math.round(process.uptime()) });
  } catch (err) {
        console.error('health : base indisponible :', err.message);
        res.status(503).json({ status: 'error', db: 'indisponible' });
      }
});

module.exports = router;
