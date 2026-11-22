const express = require('express');
const bcrypt = require('bcryptjs');
const asyncHandler = require('../lib/asyncHandler');
const { query, withTransaction } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { HttpError } = require('../lib/httpError');
const { normalizeRole, DB_ROLE } = require('../lib/roles');
const v = require('../lib/validate');

// Administration : comptes, catégories et lieux (BF3). Réservé à l'administrateur.
const router = express.Router();
router.use(requireAuth, requireRole('admin'));

const USER_COLUMNS = `u.id, u.prenom, u.nom, u.email, u.role_code, u.actif, u.cree_le`;
const toApiUser = (r) => ({ id: r.id, prenom: r.prenom, nom: r.nom, email: r.email, role: normalizeRole(r.role_code), actif: r.actif, cree_le: r.cree_le });

// ------------------------------------------------------------ comptes (RG15, RG19)
router.get('/utilisateurs', asyncHandler(async (req, res) => {
  const { rows } = await query(`SELECT ${USER_COLUMNS} FROM utilisateur u ORDER BY u.nom, u.prenom`);
  res.json(rows.map(toApiUser));
}));

function checkPassword(value) {
  if (typeof value !== 'string' || value.length < 8 || value.length > 72) {
    throw new HttpError(400, 'MOT_DE_PASSE_INVALIDE', 'Le mot de passe doit contenir entre 8 et 72 caractères.');
  }
  return value;
}

// POST /api/admin/utilisateurs : seul l'administrateur crée les comptes (pas d'inscription libre)
router.post('/utilisateurs', asyncHandler(async (req, res) => {
  const b = req.body || {};
  const nom = v.text(b.nom, 100);
  const prenom = v.text(b.prenom, 100);
  const email = v.text(b.email, 254);
  const role = normalizeRole(b.role);
  const details = [];
  if (!nom) details.push('nom');
  if (!prenom) details.push('prenom');
  if (!email || !v.EMAIL.test(email)) details.push('email');
  if (!role) details.push('role (etudiant, enseignant, technicien, superviseur ou admin)');
  if (details.length) throw new HttpError(400, 'CHAMPS_INVALIDES', 'Champs obligatoires manquants ou invalides.', details);
  const hash = await bcrypt.hash(checkPassword(b.mot_de_passe), 10);
  const { rows } = await query(
    `INSERT INTO utilisateur (nom, prenom, email, mot_de_passe_hash, role_code)
     VALUES ($1, $2, $3, $4, $5) RETURNING id, prenom, nom, email, role_code, actif, cree_le`,
    [nom, prenom, email, hash, DB_ROLE[role]]
  );
  res.status(201).json(toApiUser(rows[0]));
}));

// PATCH /api/admin/utilisateurs/:id : nom, prénom, activation, rôle, nouveau mot de passe
router.patch('/utilisateurs/:id', asyncHandler(async (req, res) => {
  const id = v.paramId(req.params.id);
  const b = req.body || {};
  const sets = [];
  const params = [id];
  const add = (column, value) => { params.push(value); sets.push(`${column} = $${params.length}`); };

  if (b.nom !== undefined) { const x = v.text(b.nom, 100); if (!x) throw new HttpError(400, 'CHAMPS_INVALIDES', 'Nom invalide.'); add('nom', x); }
  if (b.prenom !== undefined) { const x = v.text(b.prenom, 100); if (!x) throw new HttpError(400, 'CHAMPS_INVALIDES', 'Prénom invalide.'); add('prenom', x); }
  if (b.email !== undefined) { const x = v.text(b.email, 254); if (!x || !v.EMAIL.test(x)) throw new HttpError(400, 'CHAMPS_INVALIDES', 'E-mail invalide.'); add('email', x); }
  if (b.actif !== undefined) { const x = v.bool(b.actif); if (x === null) throw new HttpError(400, 'CHAMPS_INVALIDES', 'actif doit être true ou false.'); add('actif', x); }
  if (b.mot_de_passe !== undefined) add('mot_de_passe_hash', await bcrypt.hash(checkPassword(b.mot_de_passe), 10));
  let newRole = null;
  if (b.role !== undefined) {
    newRole = normalizeRole(b.role);
    if (!newRole) throw new HttpError(400, 'CHAMPS_INVALIDES', 'Rôle inconnu.');
    add('role_code', DB_ROLE[newRole]);
  }
  if (!sets.length) throw new HttpError(400, 'AUCUNE_MODIFICATION', 'Aucun champ à modifier.');
  // Garde-fou : l'administrateur ne peut pas se désactiver ni changer son propre rôle (risque de blocage)
  if (id === req.user.id && (b.actif === false || b.actif === 'false' || (newRole && newRole !== 'admin'))) {
    throw new HttpError(409, 'AUTO_MODIFICATION', 'Vous ne pouvez pas désactiver votre compte ni changer votre propre rôle.');
  }

  const user = await withTransaction(async (c) => {
    const cur = await c.query('SELECT role_code FROM utilisateur WHERE id = $1 FOR UPDATE', [id]);
    if (!cur.rows.length) throw new HttpError(404, 'UTILISATEUR_INTROUVABLE', 'Utilisateur introuvable.');
    const oldDb = cur.rows[0].role_code;
    if (newRole && DB_ROLE[newRole] !== oldDb) {
      if (oldDb === 'TECHNICIEN') throw new HttpError(409, 'ROLE_NON_MODIFIABLE', 'Un technicien ne peut pas changer de rôle : créez un nouveau compte.');
    }
    const r = await c.query(`UPDATE utilisateur SET ${sets.join(', ')} WHERE id = $1 RETURNING id, prenom, nom, email, role_code, actif, cree_le`, params);
    if (newRole === 'technicien') await c.query('INSERT INTO technicien (utilisateur_id) VALUES ($1) ON CONFLICT DO NOTHING', [id]);
    return r.rows[0];
  });
  res.json(toApiUser(user));
}));

// ------------------------------------------------------------ catégories et lieux (BF3)
// Pas de suppression (l'historique y fait référence) : on désactive.
function referentiel(path, table, label) {
  router.get(path, asyncHandler(async (req, res) => {
    const { rows } = await query(`SELECT id, libelle, actif FROM ${table} ORDER BY libelle`);
    res.json(rows);
  }));
  router.post(path, asyncHandler(async (req, res) => {
    const libelle = v.text((req.body || {}).libelle, 100);
    if (!libelle) throw new HttpError(400, 'CHAMPS_INVALIDES', `Le libellé ${label} est obligatoire.`);
    const { rows } = await query(`INSERT INTO ${table} (libelle) VALUES ($1) RETURNING id, libelle, actif`, [libelle]);
    res.status(201).json(rows[0]);
  }));
  router.patch(`${path}/:id`, asyncHandler(async (req, res) => {
    const id = v.paramId(req.params.id);
    const b = req.body || {};
    const sets = [];
    const params = [id];
    if (b.libelle !== undefined) {
      const x = v.text(b.libelle, 100);
      if (!x) throw new HttpError(400, 'CHAMPS_INVALIDES', 'Libellé invalide.');
      params.push(x); sets.push(`libelle = $${params.length}`);
    }
    if (b.actif !== undefined) {
      const x = v.bool(b.actif);
      if (x === null) throw new HttpError(400, 'CHAMPS_INVALIDES', 'actif doit être true ou false.');
      params.push(x); sets.push(`actif = $${params.length}`);
    }
    if (!sets.length) throw new HttpError(400, 'AUCUNE_MODIFICATION', 'Aucun champ à modifier.');
    const { rows } = await query(`UPDATE ${table} SET ${sets.join(', ')} WHERE id = $1 RETURNING id, libelle, actif`, params);
    if (!rows.length) throw new HttpError(404, 'INTROUVABLE', 'Élément introuvable.');
    res.json(rows[0]);
  }));
}
referentiel('/categories', 'categorie', 'de la catégorie');
referentiel('/lieux', 'lieu', 'du lieu');

module.exports = router;
