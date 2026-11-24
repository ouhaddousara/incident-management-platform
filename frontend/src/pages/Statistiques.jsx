import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { STATUTS, URGENCES } from '../ui.jsx';

// Les répartitions peuvent arriver sous forme d'objet ou de liste : on gère les deux.
const lignes = (p) => {
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

function Repartition({ titre, donnees, labels = {} }) {
  const l = lignes(donnees);
  const max = Math.max(1, ...l.map(([, n]) => n));
  return (
    <section className="card">
      <h2>{titre}</h2>
      {l.length === 0 ? (
        <p className="muted">Aucune donnée.</p>
      ) : (
        <div className="bars">
          {l.map(([k, n]) => (
            <div className="bar-row" key={k}>
              <span>{labels[k]?.label ?? k}</span>
              <div className="bar-track"><div className="bar-fill" style={{ width: `${(n / max) * 100}%` }} /></div>
              <strong>{n}</strong>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default function Statistiques() {
  const [du, setDu] = useState('');
  const [au, setAu] = useState('');
  const [s, setS] = useState(null);
  const [erreur, setErreur] = useState('');
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    setChargement(true);
    api.statistiques({ du, au })
      .then((d) => { setS(d); setErreur(''); })
      .catch((e) => setErreur(e.message))
      .finally(() => setChargement(false));
  }, [du, au]);

  const delai = s?.delai_moyen_resolution_heures;
  const cartes = s && [
    ['Incidents', s.total ?? 0, 'neutral'],
    ['À examiner', s.a_examiner ?? 0, 'warn'],
    ['Résolus', s.incidents_resolus ?? 0, 'ok'],
    ['Délai moyen de résolution', delai == null ? '—' : `${Number(delai).toFixed(1)} h`, 'info'],
  ];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Rapports</h1>
          <p>Vue d'ensemble de l'activité du HelpDesk.</p>
        </div>
        <a className="btn ghost small" href={api.exportCsvUrl({ du, au })}>Exporter en CSV</a>
      </div>

      <section className="card">
        <div className="inline-form">
          <label>Du<input type="date" value={du} onChange={(e) => setDu(e.target.value)} /></label>
          <label>Au<input type="date" value={au} onChange={(e) => setAu(e.target.value)} /></label>
          {(du || au) && <button className="btn ghost" onClick={() => { setDu(''); setAu(''); }}>Réinitialiser</button>}
        </div>
      </section>

      {erreur && <p className="error" role="alert">{erreur}</p>}
      {chargement && !s && <p className="center">Chargement…</p>}

      {s && (
        <>
          <div className="stats">
            {cartes.map(([label, n, tone]) => (
              <div className={`card stat ${tone}`} key={label}><strong>{n}</strong><span>{label}</span></div>
            ))}
          </div>
          <div className="grid2">
            <Repartition titre="Par statut" donnees={s.par_statut} labels={STATUTS} />
            <Repartition titre="Par urgence" donnees={s.par_urgence} labels={URGENCES} />
            <Repartition titre="Par catégorie" donnees={s.par_categorie} />
            <Repartition titre="Par lieu" donnees={s.par_lieu} />
          </div>
          <Repartition titre="Charge par technicien" donnees={s.charge_par_technicien} />
        </>
      )}
    </>
  );
}
