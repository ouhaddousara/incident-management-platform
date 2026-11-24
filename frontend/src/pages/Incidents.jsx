import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import { STATUTS, URGENCES } from '../ui.jsx';
import { TicketsTable } from '../tickets.jsx';

const LIMIT = 20;

export default function Incidents() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [techniciens, setTechniciens] = useState([]);
  const [categories, setCategories] = useState([]);
  const [lieux, setLieux] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');
  const [page, setPage] = useState(1);
  const [filtre, setFiltre] = useState(params.get('statut') ?? '');
  const [urgence, setUrgence] = useState('');
  const [tech, setTech] = useState('');
  const [categorie, setCategorie] = useState('');
  const [lieu, setLieu] = useState('');
  const [du, setDu] = useState('');
  const [au, setAu] = useState('');
  const [tri, setTri] = useState('recent');
  const [q, setQ] = useState(params.get('q') ?? '');
  const [qApplique, setQApplique] = useState(params.get('q') ?? '');

  // Listes des filtres : une seule fois.
  useEffect(() => {
    api.techniciens().then(setTechniciens).catch(() => {});
    api.categories().then(setCategories).catch(() => {});
    api.lieux().then(setLieux).catch(() => {});
  }, []);

  // La recherche du header (ou un bouton du dashboard) change l'adresse : on suit.
  useEffect(() => {
    const terme = params.get('q') ?? '';
    setQ(terme); setQApplique(terme);
    setFiltre(params.get('statut') ?? '');
    setPage(1);
  }, [params]);

  // Recherche : on attend la fin de la frappe.
  useEffect(() => {
    const t = setTimeout(() => { setQApplique(q); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    setChargement(true);
    api.incidents({ statut: filtre, urgence, technicien_id: tech, categorie_id: categorie, lieu_id: lieu, du, au, tri, q: qApplique, page, limit: LIMIT })
      .then((d) => { setItems(d.items); setTotal(d.total); setErreur(''); })
      .catch((e) => setErreur(e.message))
      .finally(() => setChargement(false));
  }, [filtre, urgence, tech, categorie, lieu, du, au, tri, qApplique, page]);

  const pages = Math.max(1, Math.ceil(total / LIMIT));
  const choisir = (set) => (e) => { set(e.target.value); setPage(1); };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Incidents</h1>
          <p>{user.role === 'admin' ? 'Consultation en lecture seule.' : "Ouvrez un incident pour l'examiner, l'affecter ou le clôturer."}</p>
        </div>
        <a className="btn ghost small" href={api.exportCsvUrl({ du, au })}>Exporter en CSV</a>
      </div>

      {erreur && <p className="error" role="alert">{erreur}</p>}

      <section className="card">
        <div className="toolbar" style={{ marginBottom: '.75rem' }}>
          <input type="search" placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher" />
          <select value={filtre} onChange={choisir(setFiltre)} aria-label="Statut">
            <option value="">Tous les statuts</option>
            {Object.entries(STATUTS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select value={urgence} onChange={choisir(setUrgence)} aria-label="Urgence">
            <option value="">Toutes les urgences</option>
            {Object.entries(URGENCES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select value={tech} onChange={choisir(setTech)} aria-label="Technicien">
            <option value="">Tous les techniciens</option>
            {techniciens.map((t) => <option key={t.id} value={t.id}>{t.nom}</option>)}
          </select>
        </div>
        <div className="toolbar" style={{ marginBottom: '1rem' }}>
          <select value={categorie} onChange={choisir(setCategorie)} aria-label="Catégorie">
            <option value="">Toutes les catégories</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.libelle}</option>)}
          </select>
          <select value={lieu} onChange={choisir(setLieu)} aria-label="Lieu">
            <option value="">Tous les lieux</option>
            {lieux.map((l) => <option key={l.id} value={l.id}>{l.libelle}</option>)}
          </select>
          <input type="date" value={du} onChange={choisir(setDu)} aria-label="Du" title="Du" />
          <input type="date" value={au} onChange={choisir(setAu)} aria-label="Au" title="Au" />
          <select value={tri} onChange={choisir(setTri)} aria-label="Tri">
            <option value="recent">Plus récents</option>
            <option value="ancien">Plus anciens</option>
            <option value="urgence">Par urgence</option>
          </select>
        </div>

        {chargement ? <p className="center">Chargement…</p> : <TicketsTable items={items} afficherTech />}

        <div className="row" style={{ justifyContent: 'space-between', marginTop: '1rem' }}>
          <span className="muted">{total} incident{total > 1 ? 's' : ''}</span>
          <div className="row">
            <button className="btn ghost small" disabled={page <= 1} onClick={() => setPage(page - 1)}>Précédent</button>
            <span className="muted">Page {page} sur {pages}</span>
            <button className="btn ghost small" disabled={page >= pages} onClick={() => setPage(page + 1)}>Suivant</button>
          </div>
        </div>
      </section>
    </>
  );
}
