import { useState } from 'react';
import { INCIDENTS } from '../mock.js';
import { StatutBadge } from '../ui.jsx';

// Transitions autorisées côté technicien (mock) : Affecté -> En cours -> Résolu
const SUIVANT = { 'Affecté': 'En cours', 'En cours': 'Résolu' };

export default function Technicien() {
  const [incidents, setIncidents] = useState(INCIDENTS.filter((i) => i.technicien)); // mock

  const avancer = (id) =>
    setIncidents(incidents.map((i) => (i.id === id && SUIVANT[i.statut] ? { ...i, statut: SUIVANT[i.statut] } : i)));

  return (
    <>
      <h1>Mes interventions</h1>
      <section className="card">
        <table>
          <thead><tr><th>N°</th><th>Titre</th><th>Lieu</th><th>Statut</th><th></th></tr></thead>
          <tbody>
            {incidents.map((i) => (
              <tr key={i.id}>
                <td>{i.id}</td><td>{i.titre}</td><td>{i.lieu}</td><td><StatutBadge s={i.statut} /></td>
                <td>{SUIVANT[i.statut] && <button className="btn small" onClick={() => avancer(i.id)}>Passer à « {SUIVANT[i.statut]} »</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
