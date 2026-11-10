import { useState } from 'react';
import { INCIDENTS, TECHNICIENS } from '../mock.js';
import { StatutBadge } from '../ui.jsx';

export default function Superviseur() {
  const [incidents, setIncidents] = useState(INCIDENTS); // mock

  function affecter(id, technicien) {
    setIncidents(incidents.map((i) => (i.id === id ? { ...i, technicien, statut: technicien ? 'Affecté' : 'Nouveau' } : i)));
  }
  const cloturer = (id) => setIncidents(incidents.map((i) => (i.id === id ? { ...i, statut: 'Clôturé' } : i)));

  const count = (s) => incidents.filter((i) => i.statut === s).length;
  const stats = [
    ['Total', incidents.length], ['À affecter', count('Nouveau')],
    ['En cours', count('En cours') + count('Affecté')], ['Clôturés', count('Clôturé')],
  ];

  return (
    <>
      <h1>Espace superviseur</h1>
      <div className="stats">
        {stats.map(([label, n]) => (
          <div className="card stat" key={label}><strong>{n}</strong><span>{label}</span></div>
        ))}
      </div>
      <section className="card">
        <h2>Incidents</h2>
        <table>
          <thead><tr><th>N°</th><th>Titre</th><th>Statut</th><th>Technicien</th><th></th></tr></thead>
          <tbody>
            {incidents.map((i) => (
              <tr key={i.id}>
                <td>{i.id}</td><td>{i.titre}</td><td><StatutBadge s={i.statut} /></td>
                <td>
                  <select value={i.technicien ?? ''} disabled={i.statut === 'Clôturé'} onChange={(e) => affecter(i.id, e.target.value || null)}>
                    <option value="">Non affecté</option>
                    {TECHNICIENS.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </td>
                <td>{i.statut === 'Résolu' && <button className="btn small" onClick={() => cloturer(i.id)}>Clôturer</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
