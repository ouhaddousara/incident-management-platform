// Statuts et urgences tels qu'ils sont dans la base (API HelpDesk v1.0).
export const STATUTS = {
  SIGNALE:    { label: 'Signalé',    cls: 'b-new' },
  EXAMINE:    { label: 'Examiné',    cls: 'b-aff' },
  AFFECTE:    { label: 'Affecté',    cls: 'b-aff' },
  EN_COURS:   { label: 'En cours',   cls: 'b-run' },
  RESOLU:     { label: 'Résolu',     cls: 'b-ok' },
  NON_RESOLU: { label: 'Non résolu', cls: 'b-new' },
  CLOTURE:    { label: 'Clôturé',    cls: 'b-done' },
};

export const URGENCES = {
  FAIBLE: { label: 'Faible', cls: 'b-done' },
  MOYEN:  { label: 'Moyen',  cls: 'b-aff' },
  ELEVE:  { label: 'Élevé',  cls: 'b-new' },
};

export const StatutBadge = ({ s }) => {
  const x = STATUTS[s];
  return <span className={`badge ${x?.cls ?? ''}`}>{x?.label ?? s}</span>;
};

export const UrgenceBadge = ({ u }) => {
  const x = URGENCES[u];
  return <span className={`badge ${x?.cls ?? ''}`}>{x?.label ?? u}</span>;
};

export const fmtDate = (d) =>
  d ? new Date(d).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
