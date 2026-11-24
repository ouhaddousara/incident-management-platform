import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from './api.js';
import { StatutBadge, UrgenceBadge, fmtDate } from './ui.jsx';

// Tableau de tickets réutilisé par le dashboard et les listes.
// `action` : fonction (ticket) => élément, pour une colonne de boutons.
export function TicketsTable({ items, afficherTech = false, action }) {
  if (items.length === 0) {
    return <div className="empty"><strong>Aucun ticket</strong>Rien à afficher pour le moment.</div>;
  }
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>N°</th><th>Titre</th><th>Lieu</th><th>Urgence</th><th>Statut</th>
            {afficherTech && <th>Technicien</th>}
            <th>Créé le</th>
            {action && <th></th>}
          </tr>
        </thead>
        <tbody>
          {items.map((i) => (
            <tr key={i.id}>
              <td className="num">#{i.id}</td>
              <td className="cell-title"><Link to={`/incidents/${i.id}`}>{i.titre}</Link></td>
              <td>{i.lieu}</td>
              <td><UrgenceBadge u={i.urgence} /></td>
              <td><StatutBadge s={i.statut} /></td>
              {afficherTech && <td>{i.technicien ?? <span className="muted">Non affecté</span>}</td>}
              <td className="num">{fmtDate(i.cree_le)}</td>
              {action && <td>{action(i)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Interrupteur disponible / indisponible du technicien.
export function Disponibilite() {
  const [moi, setMoi] = useState(null);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    api.technicienMoi().then(setMoi).catch((e) => setErreur(e.message));
  }, []);

  async function basculer() {
    setErreur('');
    const nouveau = !moi.disponible;
    try {
      const r = await api.majDisponibilite(nouveau);
      setMoi({ ...moi, ...(r && typeof r === 'object' ? r : {}), disponible: nouveau });
    } catch (e) {
      setErreur(e.message);
    }
  }

  if (erreur) return <p className="error" role="alert">{erreur}</p>;
  if (!moi) return null;
  return (
    <div className="row">
      <span className={`badge ${moi.disponible ? 'b-ok' : 'b-new'}`}>{moi.disponible ? 'Disponible' : 'Indisponible'}</span>
      <button className="btn ghost small" onClick={basculer}>
        {moi.disponible ? 'Me mettre indisponible' : 'Me mettre disponible'}
      </button>
    </div>
  );
}
