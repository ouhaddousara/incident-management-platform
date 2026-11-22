// Traduction des erreurs levées par la base : les règles de gestion commencent par leur numéro (RG4, RG8...).
const MESSAGES = {
  RG1: [403, 'Seul un étudiant ou un enseignant actif peut déclarer un incident.'],
  RG3: [400, 'Titre, description, lieu et catégorie sont obligatoires.'],
  RG4: [409, 'Cet incident n\'a pas d\'affectation active valide.'],
  RG5: [409, 'Ce technicien est indisponible ou inactif.'],
  RG6: [403, 'Seul un superviseur actif peut effectuer cette action.'],
  RG7: [403, 'Vous ne pouvez modifier que les incidents qui vous sont affectés.'],
  RG8: [400, 'Une remarque est obligatoire pour un incident « Non résolu ».'],
  RG9: [409, 'Cette transition de statut n\'est pas autorisée.'],
  RG10: [403, 'L\'historique ne peut être ni modifié ni supprimé.'],
  RG11: [409, 'Un incident clôturé ne peut plus être modifié.'],
  RG13: [400, 'Un motif est obligatoire pour un rejet ou un doublon.'],
  RG15: [403, 'Ce compte est désactivé.'],
  RG16: [403, 'Vous ne pouvez consulter que vos propres incidents.'],
  RG17: [400, 'Pièce jointe refusée (type ou taille non autorisé).'],
};

// Codes d'erreur PostgreSQL les plus courants (hors règles RGxx).
const PG_CODES = {
  '23505': [409, 'DEJA_EXISTANT', 'Cette valeur existe déjà.'],
  '23503': [400, 'REFERENCE_INVALIDE', 'Une des références indiquées n\'existe pas.'],
  '23514': [400, 'DONNEES_INVALIDES', 'Les données ne respectent pas les règles de gestion.'],
  '23502': [400, 'CHAMP_OBLIGATOIRE', 'Un champ obligatoire est manquant.'],
  '22P02': [400, 'VALEUR_INVALIDE', 'Une valeur n\'a pas le bon format.'],
};

function translateDbError(err) {
  const message = err && err.message ? err.message : '';
  const match = /^(RG\d+)/.exec(message);
  if (match) {
    let [status, text] = MESSAGES[match[1]] || [409, 'Règle de gestion non respectée.'];
    // Cas particuliers : la base indique que le statut a changé entre-temps (deux utilisateurs en même temps)
    if (/statut actuel/.test(message)) { status = 409; text = 'L\'incident a changé de statut entre-temps : rechargez la page.'; }
    if (/^RG6\/RG9/.test(message)) { status = 409; text = 'Cette action n\'est pas possible pour votre rôle dans l\'état actuel de l\'incident.'; }
    return { status, body: { error: match[1], message: text } };
  }
  const pg = err && err.code && PG_CODES[err.code];
  if (pg) return { status: pg[0], body: { error: pg[1], message: pg[2] } };
  return null;
}

module.exports = { translateDbError };
