// Noms de la table et des colonnes des utilisateurs (db/init/01_schema.sql)
module.exports = {
  table: 'utilisateur',
  cols: {
    id: 'id',
    prenom: 'prenom',
    nom: 'nom',
    email: 'email',
    hash: 'mot_de_passe_hash', // hash bcrypt ($2a$ / $2b$)
    role: 'role_code',         // texte, clé vers role(code)
    actif: 'actif',            // booléen (RG15)
  },
};
