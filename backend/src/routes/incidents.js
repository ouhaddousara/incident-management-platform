const express = require('express');
const asyncHandler = require('../lib/asyncHandler');
const { query, withTransaction } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { HttpError } = require('../lib/httpError');
const v = require('../lib/validate');
const inc = require('../lib/incidents');

const router = express.Router();
router.use(requireAuth);

const DECLARANTS = ['etudiant', 'enseignant'];

// ---------------------------------------------------------------- liste (BF7, BF8, BF19)
router.get('/', asyncHandler(async (req, res) => {
  const params = [];
  const where = [];
  const scope = inc.scopeClause(req.user, params);
  if (scope) where.push(scope);

  const q = req.query;
  if (q.statut) {
    const list = String(q.statut).split(',').map((s) => s.trim().toUpperCase());
    if (!list.every((s) => v.STATUTS.includes(s))) throw new HttpError(400, 'FILTRE_INVALIDE', 'Statut inconnu.');
    params.push(list);
    where.push(`i.statut = ANY($${params.length}::statut_incident[])`);
  }
  if (q.urgence) {
    const u = v.urgence(q.urgence);
    if (!u) throw new HttpError(400, 'FILTRE_INVALIDE', 'Urgence inconnue.');
    params.push(u);
    where.push(`i.urgence = $${params.length}::niveau_urgence`);
  }
  for (const [name, column] of [['categorie_id', 'i.categorie_id'], ['lieu_id', 'i.lieu_id']]) {
    if (q[name]) {
      const id = v.toId(String(q[name]));
      if (!id) throw new HttpError(400, 'FILTRE_INVALIDE', `${name} invalide.`);
      params.push(id);
      where.push(`${column} = $${params.length}`);
    }
  }
  if (q.technicien_id && (req.user.role === 'superviseur' || req.user.role === 'admin')) {
    const id = v.toId(String(q.technicien_id));
    if (!id) throw new HttpError(400, 'FILTRE_INVALIDE', 'technicien_id invalide.');
    params.push(id);
    where.push(`EXISTS (SELECT 1 FROM affectation a3 WHERE a3.incident_id = i.id AND a3.technicien_id = $${params.length} AND a3.termine_le IS NULL)`);
  }
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
  if (q.q) {
    const term = String(q.q).trim().slice(0, 100);
    if (term) {
      params.push(`%${term.replace(/[\\%_]/g, '\\$&')}%`);
      const like = `$${params.length}`;
      let clause = `i.titre ILIKE ${like} OR i.description ILIKE ${like}`;
      if (/^\d{1,12}$/.test(term)) {
        params.push(Number(term));
        clause += ` OR i.id = $${params.length}`;
      }
      where.push(`(${clause})`);
    }
  }

  const page = Math.max(1, parseInt(q.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(q.limit, 10) || 20));
  const ORDER = {
    recent: 'i.cree_le DESC, i.id DESC',
    ancien: 'i.cree_le ASC, i.id ASC',
    urgence: "CASE i.urgence WHEN 'ELEVE' THEN 1 WHEN 'MOYEN' THEN 2 ELSE 3 END, i.cree_le DESC, i.id DESC",
  };
  const order = ORDER[q.tri] || ORDER.recent;
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const total = await query(`SELECT count(*) AS n FROM incident i ${clause}`, params);
  const list = await query(`${inc.INCIDENT_SELECT} ${clause} ORDER BY ${order} LIMIT ${limit} OFFSET ${(page - 1) * limit}`, params);
  res.json({ items: list.rows, total: total.rows[0].n, page, limit });
}));

// ---------------------------------------------------------------- création (BF4 à BF6, RG1 à RG3)
router.post('/', requireRole(...DECLARANTS), asyncHandler(async (req, res) => {
  const body = req.body || {};
  const titre = v.text(body.titre, 200);
  const description = v.text(body.description, 5000);
  const categorieId = v.toId(body.categorie_id);
  const lieuId = v.toId(body.lieu_id);
  const urgence = v.urgence(body.urgence);
  const details = [];
  if (!titre) details.push('titre (obligatoire, 200 caractères maximum)');
  if (!description) details.push('description (obligatoire, 5000 caractères maximum)');
  if (!categorieId) details.push('categorie_id (obligatoire)');
  if (!lieuId) details.push('lieu_id (obligatoire)');
  if (!urgence) details.push('urgence (FAIBLE, MOYEN ou ELEVE)');
  if (details.length) throw new HttpError(400, 'CHAMPS_INVALIDES', 'Champs obligatoires manquants ou invalides.', details);

  const id = await withTransaction(async (c) => {
    const refs = await c.query('SELECT (SELECT actif FROM categorie WHERE id = $1) AS categorie, (SELECT actif FROM lieu WHERE id = $2) AS lieu', [categorieId, lieuId]);
    if (refs.rows[0].categorie !== true) throw new HttpError(400, 'CATEGORIE_INVALIDE', 'Catégorie inconnue ou désactivée.');
    if (refs.rows[0].lieu !== true) throw new HttpError(400, 'LIEU_INVALIDE', 'Lieu inconnu ou désactivé.');
    const created = await c.query(
      `INSERT INTO incident (titre, description, categorie_id, lieu_id, urgence, declarant_id)
       VALUES ($1, $2, $3, $4, $5::niveau_urgence, $6) RETURNING id`,
      [titre, description, categorieId, lieuId, urgence, req.user.id]
    );
    const newId = created.rows[0].id;
    const supervisors = await c.query("SELECT id FROM utilisateur WHERE role_code = 'SUPERVISEUR' AND actif");
    await inc.notify(c, supervisors.rows.map((r) => r.id), newId, 'SIGNALE', `Nouvel incident #${newId} : ${titre}`, req.user.id);
    return newId;
  });
  res.status(201).json(await inc.getIncidentDetail(req.user, id));
}));

// ---------------------------------------------------------------- fiche détaillée (BF17)
router.get('/:id', asyncHandler(async (req, res) => {
  res.json(await inc.getIncidentDetail(req.user, v.paramId(req.params.id)));
}));

// ---------------------------------------------------------------- actions du superviseur
function sendDetail(req, res, id) {
  return inc.getIncidentDetail(req.user, id).then((detail) => res.json(detail));
}

// Examiner : Signalé -> Examiné (BF9)
router.post('/:id/examiner', requireRole('superviseur'), asyncHandler(async (req, res) => {
  const id = v.paramId(req.params.id);
  const remarque = v.text((req.body || {}).remarque, 500);
  await withTransaction(async (c) => {
    const incident = await inc.lockIncident(c, id);
    inc.requireStatut(incident, ['SIGNALE']);
    await inc.addHistory(c, incident, 'EXAMINE', req.user.id, remarque);
    await inc.notify(c, [incident.declarant_id], id, 'EXAMINE', `Votre incident #${id} a été examiné.`, req.user.id);
  });
  await sendDetail(req, res, id);
}));

// Rejeter : Signalé -> Clôturé avec motif (RG13)
router.post('/:id/rejeter', requireRole('superviseur'), asyncHandler(async (req, res) => {
  const id = v.paramId(req.params.id);
  const motif = v.text((req.body || {}).motif, 500);
  if (!motif) throw new HttpError(400, 'MOTIF_OBLIGATOIRE', 'Un motif est obligatoire pour rejeter un incident (RG13).');
  await withTransaction(async (c) => {
    const incident = await inc.lockIncident(c, id);
    inc.requireStatut(incident, ['SIGNALE']);
    await inc.addHistory(c, incident, 'CLOTURE', req.user.id, `Rejet : ${motif}`);
    await inc.notify(c, [incident.declarant_id], id, 'CLOTURE', `Votre incident #${id} a été clôturé (rejet) : ${motif}`, req.user.id);
  });
  await sendDetail(req, res, id);
}));

// Doublon : Signalé -> Clôturé, avec l'incident d'origine (RG13)
router.post('/:id/doublon', requireRole('superviseur'), asyncHandler(async (req, res) => {
  const id = v.paramId(req.params.id);
  const body = req.body || {};
  const origineId = v.toId(body.doublon_de_id);
  if (!origineId) throw new HttpError(400, 'ORIGINE_OBLIGATOIRE', 'Indiquez l\'incident d\'origine (doublon_de_id).');
  if (origineId === id) throw new HttpError(400, 'ORIGINE_INVALIDE', 'Un incident ne peut pas être le doublon de lui-même.');
  const motif = v.text(body.motif, 500);
  await withTransaction(async (c) => {
    const incident = await inc.lockIncident(c, id);
    inc.requireStatut(incident, ['SIGNALE']);
    const origine = await c.query('SELECT id FROM incident WHERE id = $1', [origineId]);
    if (!origine.rows.length) throw new HttpError(400, 'ORIGINE_INTROUVABLE', 'L\'incident d\'origine n\'existe pas.');
    await c.query('UPDATE incident SET doublon_de_id = $2 WHERE id = $1', [id, origineId]);
    await inc.addHistory(c, incident, 'CLOTURE', req.user.id, `Doublon de l'incident #${origineId}${motif ? ' : ' + motif : ''}`);
    await inc.notify(c, [incident.declarant_id], id, 'CLOTURE', `Votre incident #${id} a été clôturé : doublon de l'incident #${origineId}.`, req.user.id);
  });
  await sendDetail(req, res, id);
}));

// Affecter / réaffecter / rouvrir (BF10, BF11, RG4, RG5, RG12, RG14)
// = une ligne dans `affectation` + la ligne d'historique correspondante, dans la même transaction.
function assignHandler(allowedStatuts, conseil) {
  return asyncHandler(async (req, res) => {
    const id = v.paramId(req.params.id);
    const body = req.body || {};
    const technicienId = v.toId(body.technicien_id);
    if (!technicienId) throw new HttpError(400, 'TECHNICIEN_OBLIGATOIRE', 'Indiquez le technicien (technicien_id).');
    const remarque = v.text(body.remarque, 500);
    await withTransaction(async (c) => {
      const incident = await inc.lockIncident(c, id);
      inc.requireStatut(incident, allowedStatuts, conseil);
      const previous = await inc.activeAssignment(c, id);
      await c.query('INSERT INTO affectation (incident_id, technicien_id, superviseur_id) VALUES ($1, $2, $3)', [id, technicienId, req.user.id]);
      await inc.addHistory(c, incident, 'AFFECTE', req.user.id, remarque);
      await inc.notify(c, [technicienId], id, 'AFFECTE', `L'incident #${id} « ${incident.titre} » vous a été affecté.`, req.user.id);
      await inc.notify(c, [incident.declarant_id], id, 'AFFECTE', `Votre incident #${id} a été affecté à un technicien.`, req.user.id);
      if (previous && previous.technicien_id !== technicienId) {
        await inc.notify(c, [previous.technicien_id], id, 'AFFECTE', `L'incident #${id} a été réaffecté à un autre technicien.`, req.user.id);
      }
    });
    await sendDetail(req, res, id);
  });
}
router.post('/:id/affecter', requireRole('superviseur'), assignHandler(['EXAMINE'], 'Examinez d\'abord l\'incident.'));
router.post('/:id/reaffecter', requireRole('superviseur'), assignHandler(['AFFECTE', 'EN_COURS', 'NON_RESOLU']));
router.post('/:id/rouvrir', requireRole('superviseur'), assignHandler(['NON_RESOLU'], 'Seul un incident non résolu peut être rouvert.'));

// Clôturer : Résolu ou Non résolu -> Clôturé (BF12)
router.post('/:id/cloturer', requireRole('superviseur'), asyncHandler(async (req, res) => {
  const id = v.paramId(req.params.id);
  const remarque = v.text((req.body || {}).remarque, 500);
  await withTransaction(async (c) => {
    const incident = await inc.lockIncident(c, id);
    inc.requireStatut(incident, ['RESOLU', 'NON_RESOLU'], 'Pour un incident signalé, utilisez « rejeter » ou « doublon ».');
    const active = await inc.activeAssignment(c, id);
    await inc.addHistory(c, incident, 'CLOTURE', req.user.id, remarque);
    await inc.notify(c, [incident.declarant_id, active && active.technicien_id], id, 'CLOTURE', `L'incident #${id} est clôturé.`, req.user.id);
  });
  await sendDetail(req, res, id);
}));

// ---------------------------------------------------------------- actions du technicien (RG7 vérifié par la base)
// Prendre en charge : Affecté -> En cours (BF14)
router.post('/:id/prendre-en-charge', requireRole('technicien'), asyncHandler(async (req, res) => {
  const id = v.paramId(req.params.id);
  await withTransaction(async (c) => {
    const incident = await inc.lockIncident(c, id);
    inc.requireStatut(incident, ['AFFECTE']);
    const active = await inc.activeAssignment(c, id);
    await inc.addHistory(c, incident, 'EN_COURS', req.user.id, null);
    await inc.notify(c, [incident.declarant_id, active && active.superviseur_id], id, 'EN_COURS', `L'incident #${id} est pris en charge.`, req.user.id);
  });
  await sendDetail(req, res, id);
}));

// Résoudre : En cours -> Résolu (BF15)
router.post('/:id/resoudre', requireRole('technicien'), asyncHandler(async (req, res) => {
  const id = v.paramId(req.params.id);
  const remarque = v.text((req.body || {}).remarque, 500);
  await withTransaction(async (c) => {
    const incident = await inc.lockIncident(c, id);
    inc.requireStatut(incident, ['EN_COURS']);
    const active = await inc.activeAssignment(c, id);
    await inc.addHistory(c, incident, 'RESOLU', req.user.id, remarque);
    await inc.notify(c, [incident.declarant_id, active && active.superviseur_id], id, 'RESOLU', `L'incident #${id} est résolu, en attente de vérification.`, req.user.id);
  });
  await sendDetail(req, res, id);
}));

// Non résolu : En cours -> Non résolu, remarque obligatoire (BF15, RG8)
router.post('/:id/non-resolu', requireRole('technicien'), asyncHandler(async (req, res) => {
  const id = v.paramId(req.params.id);
  const remarque = v.text((req.body || {}).remarque, 500);
  if (!remarque) throw new HttpError(400, 'REMARQUE_OBLIGATOIRE', 'Une remarque est obligatoire pour un incident non résolu (RG8).');
  await withTransaction(async (c) => {
    const incident = await inc.lockIncident(c, id);
    inc.requireStatut(incident, ['EN_COURS']);
    const active = await inc.activeAssignment(c, id);
    await inc.addHistory(c, incident, 'NON_RESOLU', req.user.id, remarque);
    await inc.notify(c, [incident.declarant_id, active && active.superviseur_id], id, 'NON_RESOLU', `L'incident #${id} n'a pas pu être résolu : ${remarque}`, req.user.id);
  });
  await sendDetail(req, res, id);
}));

// Pièce jointe (RG17)
router.use('/:id/piece-jointe', require('./attachments'));

module.exports = router;
