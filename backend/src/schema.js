// >>> À ADAPTER si les noms de db/init/*.sql sont différents <<<
// Un seul endroit à modifier : table et colonnes de la table des utilisateurs.
module.exports = {
  table: 'utilisateur',
  cols: {
    id: 'id',
    nom: 'nom',
    email: 'email',
    hash: 'mot_de_passe_hash', // hash bcrypt ($2a$ / $2b$)
    role: 'role',              // texte : etudiant, enseignant, technicien, superviseur, admin
    actif: 'actif',            // booléen (RG15)
  },
};
