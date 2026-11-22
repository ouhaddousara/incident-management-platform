const express = require('express');
const asyncHandler = require('../lib/asyncHandler');
const { query } = require('../db');
const { requireAuth } = require('../middleware/auth');
const v = require('../lib/validate');

// Notifications dans l'application (BF18, RG18) : chaque utilisateur ne voit que les siennes.
const router = express.Router();
router.use(requireAuth);

// GET /api/notifications?non_lues=1&limit=20
router.get('/', asyncHandler(async (req, res) => {
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const onlyUnread = req.query.non_lues === '1' || req.query.non_lues === 'true';
  const [items, count] = await Promise.all([
    query(`SELECT id, incident_id, etape, message, lue, cree_le FROM notification
           WHERE destinataire_id = $1 ${onlyUnread ? 'AND NOT lue' : ''}
           ORDER BY cree_le DESC, id DESC LIMIT ${limit}`, [req.user.id]),
    query('SELECT count(*) AS n FROM notification WHERE destinataire_id = $1 AND NOT lue', [req.user.id]),
  ]);
  res.json({ non_lues: count.rows[0].n, items: items.rows });
}));

// POST /api/notifications/lues : tout marquer comme lu
router.post('/lues', asyncHandler(async (req, res) => {
  const r = await query('UPDATE notification SET lue = true WHERE destinataire_id = $1 AND NOT lue', [req.user.id]);
  res.json({ marquees: r.rowCount });
}));

// POST /api/notifications/:id/lue
router.post('/:id/lue', asyncHandler(async (req, res) => {
  const id = v.paramId(req.params.id);
  const r = await query('UPDATE notification SET lue = true WHERE id = $1 AND destinataire_id = $2', [id, req.user.id]);
  if (!r.rowCount) return res.status(404).json({ error: 'NOTIFICATION_INTROUVABLE', message: 'Notification introuvable.' });
  res.json({ id, lue: true });
}));

module.exports = router;
