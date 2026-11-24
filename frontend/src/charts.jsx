// Graphiques simples en SVG / CSS (pas de bibliothèque à installer).

// Les répartitions de l'API peuvent être un objet ou une liste : on gère les deux.
export const lignes = (p) => {
  if (!p) return [];
  if (Array.isArray(p)) {
    return p.map((e) => [
      e.statut ?? e.urgence ?? e.categorie ?? e.lieu ?? e.technicien ?? e.nom ?? e.libelle ?? e.code ?? e.cle ?? '?',
      Number(e.nombre ?? e.total ?? e.count ?? e.n ?? e.charge ?? e.valeur ?? 0),
    ]);
  }
  return Object.entries(p).map(([k, v]) => [
    k,
    Number(v && typeof v === 'object' ? (v.nombre ?? v.total ?? v.count ?? 0) : v),
  ]);
};

// Compteur d'un code précis dans une répartition.
export const nb = (p, code) => Number(lignes(p).find(([k]) => k === code)?.[1] ?? 0);

export const COULEURS_STATUT = {
  SIGNALE: '#e5484d', EXAMINE: '#f5a524', AFFECTE: '#8b5cf6', EN_COURS: '#3b82f6',
  RESOLU: '#16a34a', NON_RESOLU: '#be123c', CLOTURE: '#64748b',
};
export const COULEURS_URGENCE = { FAIBLE: '#94a3b8', MOYEN: '#f59e0b', ELEVE: '#e5484d' };

const PALETTE = ['#0b6e6e', '#3b82f6', '#f59e0b', '#8b5cf6', '#e5484d', '#16a34a', '#64748b'];
const couleurDe = (couleurs, k, i) => couleurs[k] ?? PALETTE[i % PALETTE.length];

export function Donut({ data, labels = {}, couleurs = {}, centre = 'Total' }) {
  const total = data.reduce((s, [, n]) => s + n, 0);
  if (total === 0) return <p className="muted">Aucune donnée pour le moment.</p>;

  const R = 52;
  const C = 2 * Math.PI * R;
  let cumul = 0;

  return (
    <div className="donut-wrap">
      <svg viewBox="0 0 140 140" width="150" height="150" role="img" aria-label="Répartition">
        <circle cx="70" cy="70" r={R} fill="none" stroke="#eef2f6" strokeWidth="18" />
        {data.map(([k, n], i) => {
          if (!n) return null;
          const len = (n / total) * C;
          const el = (
            <circle key={k} cx="70" cy="70" r={R} fill="none" stroke={couleurDe(couleurs, k, i)}
              strokeWidth="18" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-cumul}
              transform="rotate(-90 70 70)" />
          );
          cumul += len;
          return el;
        })}
        <text x="70" y="68" textAnchor="middle" fontSize="24" fontWeight="600" fill="#0f172a">{total}</text>
        <text x="70" y="86" textAnchor="middle" fontSize="10" fill="#64748b">{centre}</text>
      </svg>
      <ul className="legend">
        {data.map(([k, n], i) => (
          <li key={k}>
            <span className="dot" style={{ background: couleurDe(couleurs, k, i) }} />
            {labels[k]?.label ?? k}
            <strong>{n}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function BarList({ data, labels = {}, couleurs = {} }) {
  if (data.length === 0 || data.every(([, n]) => n === 0)) return <p className="muted">Aucune donnée pour le moment.</p>;
  const max = Math.max(1, ...data.map(([, n]) => n));
  return (
    <div className="bars">
      {data.map(([k, n], i) => (
        <div className="bar-row" key={k}>
          <span title={labels[k]?.label ?? k}>{labels[k]?.label ?? k}</span>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${(n / max) * 100}%`, background: couleurs[k] ?? PALETTE[i % PALETTE.length] }} />
          </div>
          <strong>{n}</strong>
        </div>
      ))}
    </div>
  );
}
