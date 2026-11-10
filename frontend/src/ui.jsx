const COULEURS = {
  'Nouveau': 'b-new', 'Affecté': 'b-aff', 'En cours': 'b-run', 'Résolu': 'b-ok', 'Clôturé': 'b-done',
};
export const StatutBadge = ({ s }) => <span className={`badge ${COULEURS[s] ?? ''}`}>{s}</span>;
