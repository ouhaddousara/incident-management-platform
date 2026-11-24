import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import { Icon } from '../icons.jsx';
import { Donut, BarList, lignes, nb, COULEURS_STATUT, COULEURS_URGENCE } from '../charts.jsx';
import { STATUTS, URGENCES } from '../ui.jsx';
import { TicketsTable } from '../tickets.jsx';
import { LISTE } from '../nav.js';

const ACCUEIL = {
  etudiant:    { sous: 'Signalez un problème et suivez son traitement.', bouton: ['/nouveau-ticket', 'Créer un ticket', 'plus'] },
  enseignant:  { sous: 'Signalez un problème et suivez son traitement.', bouton: ['/nouveau-ticket', 'Créer un ticket', 'plus'] },
  technicien:  { sous: 'Voici les interventions qui vous sont confiées.', bouton: ['/mes-tickets', 'Voir mes tickets', 'ticket'] },
  superviseur: { sous: "Suivez l'activité et affectez les incidents.", bouton: ['/incidents?statut=SIGNALE', 'Examiner les incidents', 'alert'] },
  admin:       { sous: 'Supervisez la plateforme et gérez les comptes.', bouton: ['/utilisateurs', 'Gérer les utilisateurs', 'users'] },
};

const ORDRE_STATUT = Object.keys(STATUTS);
const ORDRE_URGENCE = ['ELEVE', 'MOYEN', 'FAIBLE'];
const trier = (data, ordre) => [...data].sort((a, b) => ordre.indexOf(a[0]) - ordre.indexOf(b[0]));

const compter = (items, cle) => {
  const m = {};
  items.forEach((i) => { if (i[cle]) m[i[cle]] = (m[i[cle]] ?? 0) + 1; });
  return Object.entries(m);
};

// Déclarant et technicien : tout est calculé à partir de leurs propres tickets.
function depuisListe(d, role) {
  const items = d.items;
  const c = (...s) => items.filter((i) => s.includes(i.statut)).length;
  const total = d.total ?? items.length;
  const cartes = role === 'technicien'
    ? [['Total', total, 'neutral', 'ticket'], ['À démarrer', c('AFFECTE'), 'warn', 'clock'], ['En cours', c('EN_COURS'), 'info', 'alert'], ['Terminés', c('RESOLU', 'NON_RESOLU', 'CLOTURE'), 'ok', 'check']]
    : [['Total', total, 'neutral', 'ticket'], ['Signalés', c('SIGNALE'), 'warn', 'alert'], ['En traitement', c('EXAMINE', 'AFFECTE', 'EN_COURS', 'NON_RESOLU'), 'info', 'clock'], ['Résolus / clôturés', c('RESOLU', 'CLOTURE'), 'ok', 'check']];
  return { cartes, statut: compter(items, 'statut'), urgence: compter(items, 'urgence'), categorie: compter(items, 'categorie'), recents: items.slice(0, 5) };
}

// Superviseur et admin : chiffres globaux fournis par l'API.
function depuisStats(s, d) {
  const ps = s.par_statut;
  return {
    cartes: [
      ['Total', s.total ?? 0, 'neutral', 'ticket'],
      ['À examiner', s.a_examiner ?? 0, 'warn', 'alert'],
      ['En cours', nb(ps, 'AFFECTE') + nb(ps, 'EN_COURS'), 'info', 'clock'],
      ['Résolus', s.incidents_resolus ?? nb(ps, 'RESOLU'), 'ok', 'check'],
    ],
    statut: lignes(ps),
    urgence: lignes(s.par_urgence),
    categorie: lignes(s.par_categorie),
    recents: d.items,
  };
}

export default function Dashboard() {
  const { user } = useAuth();
  const cfg = ACCUEIL[user.role];
  const gestion = user.role === 'superviseur' || user.role === 'admin';
  const [data, setData] = useState(null);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    const charge = gestion
      ? Promise.all([api.statistiques(), api.incidents({ limit: 5 })]).then(([s, d]) => depuisStats(s, d))
      : api.incidents({ limit: 100 }).then((d) => depuisListe(d, user.role));
    charge.then(setData).catch((e) => setErreur(e.message));
  }, [gestion, user.role]);

  const categories = data ? [...data.categorie].sort((a, b) => b[1] - a[1]).slice(0, 6) : [];

  return (
    <>
      <section className="welcome">
        <div>
          <h1>Bienvenue, {user.nom}</h1>
          <p>{cfg.sous}</p>
        </div>
        <Link className="btn btn-light" to={cfg.bouton[0]}><Icon name={cfg.bouton[2]} /> {cfg.bouton[1]}</Link>
      </section>

      {erreur && <p className="error" role="alert">{erreur}</p>}
      {!data && !erreur && <p className="center">Chargement…</p>}

      {data && (
        <>
          <div className="stats">
            {data.cartes.map(([label, n, tone, icone]) => (
              <div className={`card stat ${tone}`} key={label}>
                <i className="stat-icon"><Icon name={icone} /></i>
                <strong>{n}</strong>
                <span>{label}</span>
              </div>
            ))}
          </div>

          <div className="dash-grid">
            <section className="card">
              <h2>Incidents par statut</h2>
              <Donut data={trier(data.statut, ORDRE_STATUT)} labels={STATUTS} couleurs={COULEURS_STATUT} />
            </section>
            <section className="card">
              <h2>Par urgence</h2>
              <BarList data={trier(data.urgence, ORDRE_URGENCE)} labels={URGENCES} couleurs={COULEURS_URGENCE} />
            </section>
            <section className="card">
              <h2>Par catégorie</h2>
              <BarList data={categories} />
            </section>
          </div>

          <section className="card">
            <div className="card-head">
              <h2>Derniers tickets</h2>
              <Link to={LISTE[user.role]} className="link-btn">Voir tout →</Link>
            </div>
            <TicketsTable items={data.recents} afficherTech={gestion} />
          </section>
        </>
      )}
    </>
  );
}
