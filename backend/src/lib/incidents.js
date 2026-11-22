const { query } = require('../db');
const { HttpError } = require('./httpError');

// Sélection commune : un incident avec sa catégorie, son lieu, son déclarant et le dernier technicien affecté.
const INCIDENT_SELECT = `
  SELECT i.id, i.titre, i.description, i.statut, i.urgence, i.doublon_de_id,
         i.cree_le, i.mis_a_jour_le,
         c.id AS categorie_id, c.libelle AS categorie,
         l.id AS lieu_id, l.libelle AS lieu,
         d.id AS declarant_id, d.prenom || ' ' || d.nom AS declarant,
         t.id AS technicien_id, t.prenom || ' ' || t.nom AS technicien
  FROM incident i
  JOIN categorie c ON c.id = i.categorie_id
  JOIN lieu l ON l.id = i.lieu_id
  JOIN utilisateur d ON d.id = i.declarant_id
  LEFT JOIN LATERAL (
    SELECT technicien_id FROM affectation WHERE incident_id = i.id ORDER BY affecte_le DESC, id DESC LIMIT 1
  ) a ON true
  LEFT JOIN utilisateur t ON t.id = a.technicien_id`;

// Ce que chaque rôle a le droit de voir (RG16) : le déclarant ses incidents, le technicien ceux
// qui lui ont été affectés, le superviseur et l'administrateur tous les incidents.
function scopeClause(user, params) {
  if (user.role === 'etudiant' || user.role === 'enseignant') {
    params.push(user.id);
    return `i.declarant_id = $${params.length}`;
  }
  if (user.role === 'technicien') {
    params.push(user.id);
    return `EXISTS (SELECT 1 FROM affectation a2 WHERE a2.incident_id = i.id AND a2.technicien_id = $${params.length})`;
  }
  return null;
}

// Vrai si l'utilisateur peut voir cet incident.
async function canView(user, incidentId, declarantId) {
  if (user.role === 'superviseur' || user.role === 'admin') return true;
  if (user.role === 'etudiant' || user.role === 'enseignant') return declarantId === user.id;
  if (user.role === 'technicien') {
    const { rows } = await query('SELECT 1 FROM affectation WHERE incident_id = $1 AND technicien_id = $2 LIMIT 1', [incidentId, user.id]);
    return rows.length > 0;
  }
  return false;
}

// Boutons (actions) proposés selon le rôle, le statut et l'affectation : le Front les affiche tels quels.
function availableActions(role, statut, assignedToMe) {
  const actions = [];
  if (role === 'superviseur') {
    if (statut === 'SIGNALE') actions.push('examiner', 'rejeter', 'doublon');
    if (statut === 'EXAMINE') actions.push('affecter');
    if (statut === 'AFFECTE' || statut === 'EN_COURS') actions.push('reaffecter');
    if (statut === 'RESOLU') actions.push('cloturer');
    if (statut === 'NON_RESOLU') actions.push('cloturer', 'rouvrir');
  }
  if (role === 'technicien' && assignedToMe) {
    if (statut === 'AFFECTE') actions.push('prendre_en_charge');
    if (statut === 'EN_COURS') actions.push('resoudre', 'non_resolu');
  }
  return actions;
}

// Incident complet : fiche, historique, affectation active, pièce jointe, actions possibles.
async function getIncidentDetail(user, incidentId) {
  const { rows } = await query(`${INCIDENT_SELECT} WHERE i.id = $1`, [incidentId]);
  if (!rows.length) throw new HttpError(404, 'INCIDENT_INTROUVABLE', 'Incident introuvable.');
  const incident = rows[0];
  if (!(await canView(user, incident.id, incident.declarant_id))) {
    throw new HttpError(403, 'RG16', 'Vous ne pouvez consulter que vos propres incidents.');
  }
  const [historique, affectation, piece] = await Promise.all([
    query(`SELECT h.id, h.ancien_statut, h.nouveau_statut, h.date_heure, h.remarque,
                  u.id AS auteur_id, u.prenom || ' ' || u.nom AS auteur
           FROM historique_statut h JOIN utilisateur u ON u.id = h.auteur_id
           WHERE h.incident_id = $1 ORDER BY h.date_heure, h.id`, [incidentId]),
    query(`SELECT a.technicien_id, u.prenom || ' ' || u.nom AS technicien, a.superviseur_id, a.affecte_le
           FROM affectation a JOIN utilisateur u ON u.id = a.technicien_id
           WHERE a.incident_id = $1 AND a.termine_le IS NULL`, [incidentId]),
    query('SELECT id, nom_fichier, type_mime, taille_octets FROM piece_jointe WHERE incident_id = $1', [incidentId]),
  ]);
  const active = affectation.rows[0] || null;
  return {
    ...incident,
    historique: historique.rows,
    affectation_active: active,
    piece_jointe: piece.rows[0] || null,
    actions: availableActions(user.role, incident.statut, !!active && active.technicien_id === user.id),
  };
}

// Verrouille l'incident pendant la transaction ; 404 s'il n'existe pas.
async function lockIncident(client, id) {
  const { rows } = await client.query('SELECT id, titre, statut, declarant_id FROM incident WHERE id = $1 FOR UPDATE', [id]);
  if (!rows.length) throw new HttpError(404, 'INCIDENT_INTROUVABLE', 'Incident introuvable.');
  return rows[0];
}

// 409 si l'incident n'est pas dans un des statuts attendus.
function requireStatut(incident, statuts, conseil) {
  if (!statuts.includes(incident.statut)) {
    throw new HttpError(409, 'STATUT_INCOMPATIBLE', `Action impossible : l'incident est au statut ${incident.statut}.${conseil ? ' ' + conseil : ''}`);
  }
}

// Le statut ne change JAMAIS par UPDATE : on ajoute une ligne d'historique, la base valide la transition
// (rôle, ordre, affectation) et met le statut à jour (triggers de db/init/02_logic.sql).
async function addHistory(client, incident, nouveau, auteurId, remarque) {
  await client.query(
    `INSERT INTO historique_statut (incident_id, ancien_statut, nouveau_statut, auteur_id, remarque)
     VALUES ($1, $2::statut_incident, $3::statut_incident, $4, $5)`,
    [incident.id, incident.statut, nouveau, auteurId, remarque || null]
  );
}

async function activeAssignment(client, incidentId) {
  const { rows } = await client.query('SELECT technicien_id, superviseur_id FROM affectation WHERE incident_id = $1 AND termine_le IS NULL', [incidentId]);
  return rows[0] || null;
}

// Notifications dans l'application (décision d'équipe : pas d'e-mail). L'auteur de l'action n'est pas notifié.
async function notify(client, recipients, incidentId, etape, message, exceptUserId) {
  const ids = [...new Set(recipients.filter(Boolean).map(Number))].filter((id) => id !== Number(exceptUserId));
  if (!ids.length) return;
  await client.query(
    `INSERT INTO notification (destinataire_id, incident_id, etape, message)
     SELECT x, $2::bigint, $3::statut_incident, $4::text FROM unnest($1::bigint[]) AS x`,
    [ids, incidentId, etape, message]
  );
}

module.exports = { INCIDENT_SELECT, scopeClause, canView, availableActions, getIncidentDetail, lockIncident, requireStatut, addHistory, activeAssignment, notify };
