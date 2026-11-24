import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { Icon } from '../icons.jsx';
import { STATUTS } from '../ui.jsx';
import { TicketsTable } from '../tickets.jsx';

export default function MesTickets() {
  const [params] = useSearchParams();
  const [incidents, setIncidents] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');
  const [recherche, setRecherche] = useState(params.get('q') ?? '');
  const [filtre, setFiltre] = useState(params.get('statut') ?? '');

  // La recherche du header change l'adresse : on suit.
  useEffect(() => {
    setRecherche(params.get('q') ?? '');
    setFiltre(params.get('statut') ?? '');
  }, [params]);

  useEffect(() => {
    api.incidents({ limit: 100 })
      .then((d) => setIncidents(d.items))
      .catch((e) => setErreur(e.message))
      .finally(() => setChargement(false));
  }, []);

  const visibles = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return incidents.filter((i) =>
      (!filtre || i.statut === filtre) &&
      (!q || `${i.id} ${i.titre} ${i.lieu} ${i.categorie}`.toLowerCase().includes(q)));
  }, [incidents, recherche, filtre]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Mes tickets</h1>
          <p>Suivez le traitement de vos signalements.</p>
        </div>
        <Link className="btn" to="/nouveau-ticket"><Icon name="plus" /> Créer un ticket</Link>
      </div>

      {erreur && <p className="error" role="alert">{erreur}</p>}

      <section className="card">
        <div className="card-head">
          <h2>{visibles.length} ticket{visibles.length > 1 ? 's' : ''}</h2>
          <div className="toolbar">
            <input type="search" placeholder="Rechercher…" value={recherche} onChange={(e) => setRecherche(e.target.value)} aria-label="Rechercher" />
            <select value={filtre} onChange={(e) => setFiltre(e.target.value)} aria-label="Filtrer par statut">
              <option value="">Tous les statuts</option>
              {Object.entries(STATUTS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
        </div>
        {chargement ? <p className="center">Chargement…</p> : <TicketsTable items={visibles} />}
      </section>
    </>
  );
}
