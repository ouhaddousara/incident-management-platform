const express = require('express');
const asyncHandler = require('../lib/asyncHandler');
const { query } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { HttpError } = require('../lib/httpError');
const v = require('../lib/validate');

const router = express.Router();
router.use(requireAuth);

// Techniciens avec leur disponibilité et leur charge actuelle (BF10) : incidents non clôturés affectés.
const TECHNICIENS = `
  SELECT t.utilisateur_id AS id, u.prenom || ' ' || u.nom AS nom, u.email, t.disponible, u.actif,
         (SELECT count(*) FROM affectation a JOIN incident i ON i.id = a.incident_id
          WHERE a.technicien_id = t.utilisateur_id AND a.termine_le IS NULL AND i.statut <> 'CLOTURE') AS charge
  FROM technicien t JOIN utilisateur u ON u.id = t.utilisateur_id`;

// GET /api/techniciens : pour le superviseur qui affecte (actifs seulement) ; l'admin peut tout voir avec ?tous=1
router.get('/', requireRole('superviseur', 'admin'), asyncHandler(async (req, res) => {
  const all = req.user.role === 'admin' && req.query.tous === '1';
  const { rows } = await query(`${TECHNICIENS} ${all ? '' : 'WHERE u.actif'} ORDER BY u.nom, u.prenom`);
  res.json(rows);
}));

// GET /api/techniciens/moi
router.get('/moi', requireRole('technicien'), asyncHandler(async (req, res) => {
  const { rows } = await query(`${TECHNICIENS} WHERE t.utilisateur_id = $1`, [req.user.id]);
  res.json(rows[0]);
}));

// PATCH /api/techniciens/moi { "disponible": true|false } (BF16, RG5, RG14)
router.patch('/moi', requireRole('technicien'), asyncHandler(async (req, res) => {
  const disponible = v.bool((req.body || {}).disponible);
  if (disponible === null) throw new HttpError(400, 'CHAMPS_INVALIDES', 'Indiquez « disponible » (true ou false).');
  await query('UPDATE technicien SET disponible = $2 WHERE utilisateur_id = $1', [req.user.id, disponible]);
  const { rows } = await query(`${TECHNICIENS} WHERE t.utilisateur_id = $1`, [req.user.id]);
  res.json(rows[0]);
}));

module.exports = router;
