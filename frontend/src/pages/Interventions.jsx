import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { STATUTS } from '../ui.jsx';
import { TicketsTable, Disponibilite } from '../tickets.jsx';

export default function Interventions() {
  const [params] = useSearchParams();
  const [incidents, setIncidents] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');
  const [recherche, setRecherche] = useState(params.get('q') ?? '');
  const [filtre, setFiltre] = useState(params.get('statut') ?? '');
  const [busyId, setBusyId] = useState(null);

  // La recherche du header change l'adresse : on suit.
  useEffect(() => {
    setRecherche(params.get('q') ?? '');
    setFiltre(params.get('statut') ?? '');
  }, [params]);

  const recharger = () =>
    api.incidents({ limit: 100 }).then((d) => setIncidents(d.items)).catch((e) => setErreur(e.message));

  useEffect(() => { recharger().finally(() => setChargement(false)); }, []);

  async function prendreEnCharge(id) {
    setErreur(''); setBusyId(id);
    try {
      await api.action(id, 'prendre-en-charge');
      await recharger();
    } catch (e) {
      setErreur(e.message);
    } finally {
      setBusyId(null);
    }
  }

  const visibles = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return incidents.filter((i) =>
      (!filtre || i.statut === filtre) &&
      (!q || `${i.id} ${i.titre} ${i.lieu}`.toLowerCase().includes(q)));
  }, [incidents, recherche, filtre]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Mes tickets</h1>
          <p>Les incidents qui vous sont affectés.</p>
        </div>
        <Disponibilite />
      </div>

      {erreur && <p className="error" role="alert">{erreur}</p>}

      <section className="card">
        <div className="card-head">
          <h2>{visibles.length} intervention{visibles.length > 1 ? 's' : ''}</h2>
          <div className="toolbar">
            <input type="search" placeholder="Rechercher…" value={recherche} onChange={(e) => setRecherche(e.target.value)} aria-label="Rechercher" />
            <select value={filtre} onChange={(e) => setFiltre(e.target.value)} aria-label="Filtrer par statut">
              <option value="">Tous les statuts</option>
              {['AFFECTE', 'EN_COURS', 'RESOLU', 'NON_RESOLU', 'CLOTURE'].map((s) => <option key={s} value={s}>{STATUTS[s].label}</option>)}
            </select>
          </div>
        </div>
        {chargement ? (
          <p className="center">Chargement…</p>
        ) : (
          <TicketsTable
            items={visibles}
            action={(i) => i.statut === 'AFFECTE' && (
              <button className="btn small" disabled={busyId === i.id} onClick={() => prendreEnCharge(i.id)}>
                Prendre en charge
              </button>
            )}
          />
        )}
      </section>
    </>
  );
}
