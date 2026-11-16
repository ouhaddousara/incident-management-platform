// Traduction des erreurs levées par la base : elles commencent par le numéro de la règle (RG4, RG8...).
const MESSAGES = {
  RG3: [400, 'Titre, description, lieu et catégorie sont obligatoires.'],
  RG4: [409, 'Cet incident est déjà affecté à un technicien.'],
  RG5: [409, 'Ce technicien est indisponible.'],
  RG6: [403, 'Seul le superviseur peut effectuer cette action.'],
  RG7: [403, 'Vous ne pouvez modifier que les incidents qui vous sont affectés.'],
  RG8: [400, 'Une remarque est obligatoire pour un incident « Non résolu ».'],
  RG9: [409, 'Cette transition de statut n\'est pas autorisée.'],
  RG11: [409, 'Un incident clôturé ne peut plus être modifié.'],
  RG13: [400, 'Un motif est obligatoire pour un rejet ou un doublon.'],
  RG15: [403, 'Ce compte est désactivé.'],
  RG16: [403, 'Vous ne pouvez consulter que vos propres incidents.'],
  RG17: [400, 'Pièce jointe refusée (type ou taille non autorisé).'],
};

function translateDbError(err) {
  const match = /^(RG\d+)/.exec(err && err.message ? err.message : '');
  if (!match) return null;
  const [status, message] = MESSAGES[match[1]] || [409, 'Règle de gestion non respectée.'];
  return { status, body: { error: match[1], message } };
}

module.exports = { translateDbError };
