const express = require('express');
const asyncHandler = require('../lib/asyncHandler');
const { query } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { HttpError } = require('../lib/httpError');
const v = require('../lib/validate');
const { INCIDENT_SELECT } = require('../lib/incidents');

const router = express.Router();
router.use(requireAuth, requireRole('superviseur', 'admin'));

// Filtre de période commun (du / au, AAAA-MM-JJ) sur la date de création.
function periode(q) {
  const params = [];
  const where = [];
  if (q.du) {
    if (!v.isoDate(String(q.du))) throw new HttpError(400, 'FILTRE_INVALIDE', 'Date « du » invalide (AAAA-MM-JJ).');
    params.push(q.du);
    where.push(`i.cree_le >= $${params.length}::date`);
  }
  if (q.au) {
    if (!v.isoDate(String(q.au))) throw new HttpError(400, 'FILTRE_INVALIDE', 'Date « au » invalide (AAAA-MM-JJ).');
    params.push(q.au);
    where.push(`i.cree_le < ($${params.length}::date + 1)`);
  }
  return { params, clause: where.length ? `WHERE ${where.join(' AND ')}` : '' };
}

// GET /api/statistiques : tableau de bord (BF20, BF21)
router.get('/', asyncHandler(async (req, res) => {
  const { params, clause } = periode(req.query);
  const [total, parStatut, parCategorie, parLieu, parUrgence, delai, charge] = await Promise.all([
    query(`SELECT count(*) AS n FROM incident i ${clause}`, params),
    query(`SELECT i.statut AS cle, count(*) AS n FROM incident i ${clause} GROUP BY i.statut`, params),
    query(`SELECT c.libelle AS cle, count(*) AS n FROM incident i JOIN categorie c ON c.id = i.categorie_id ${clause} GROUP BY c.libelle ORDER BY n DESC, c.libelle`, params),
    query(`SELECT l.libelle AS cle, count(*) AS n FROM incident i JOIN lieu l ON l.id = i.lieu_id ${clause} GROUP BY l.libelle ORDER BY n DESC, l.libelle`, params),
    query(`SELECT i.urgence AS cle, count(*) AS n FROM incident i ${clause} GROUP BY i.urgence`, params),
    // Délai moyen de résolution : du signalement à la première ligne d'historique « Résolu », en heures
    query(`SELECT avg(extract(epoch FROM (r.d - i.cree_le)) / 3600)::float8 AS heures, count(*) AS n
           FROM incident i
           JOIN LATERAL (SELECT min(h.date_heure) AS d FROM historique_statut h
                         WHERE h.incident_id = i.id AND h.nouveau_statut = 'RESOLU') r ON r.d IS NOT NULL
           ${clause}`, params),
    query(`SELECT t.utilisateur_id AS id, u.prenom || ' ' || u.nom AS nom, t.disponible,
                  (SELECT count(*) FROM affectation a JOIN incident i ON i.id = a.incident_id
                   WHERE a.technicien_id = t.utilisateur_id AND a.termine_le IS NULL AND i.statut <> 'CLOTURE') AS charge
           FROM technicien t JOIN utilisateur u ON u.id = t.utilisateur_id WHERE u.actif ORDER BY u.nom, u.prenom`),
  ]);

  const statuts = Object.fromEntries(v.STATUTS.map((s) => [s, 0]));
  parStatut.rows.forEach((r) => { statuts[r.cle] = r.n; });
  const urgences = { FAIBLE: 0, MOYEN: 0, ELEVE: 0 };
  parUrgence.rows.forEach((r) => { urgences[r.cle] = r.n; });
  const heures = delai.rows[0].heures;

  res.json({
    total: total.rows[0].n,
    a_examiner: statuts.SIGNALE,
    par_statut: statuts,
    par_urgence: urgences,
    par_categorie: parCategorie.rows,
    par_lieu: parLieu.rows,
    delai_moyen_resolution_heures: heures === null ? null : Math.round(heures * 10) / 10,
    incidents_resolus: delai.rows[0].n,
    charge_par_technicien: charge.rows,
  });
}));

// Protection contre l'injection de formules dans Excel (cellule commençant par = + - @).
function csvCell(value) {
  let s = value === null || value === undefined ? '' : value instanceof Date ? value.toISOString() : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

// GET /api/statistiques/export.csv : export des incidents (BF22, souhaitable)
router.get('/export.csv', asyncHandler(async (req, res) => {
  const { params, clause } = periode(req.query);
  const { rows } = await query(`${INCIDENT_SELECT} ${clause} ORDER BY i.id LIMIT 10000`, params);
  const head = ['Numéro', 'Titre', 'Statut', 'Urgence', 'Catégorie', 'Lieu', 'Déclarant', 'Technicien', 'Créé le', 'Mis à jour le'];
  const lines = [head.map(csvCell).join(';')];
  for (const r of rows) {
    lines.push([r.id, r.titre, r.statut, r.urgence, r.categorie, r.lieu, r.declarant, r.technicien, r.cree_le, r.mis_a_jour_le].map(csvCell).join(';'));
  }
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', 'attachment; filename="incidents.csv"');
  res.send('\uFEFF' + lines.join('\r\n') + '\r\n'); // BOM : Excel affiche correctement les accents
}));

module.exports = router;
