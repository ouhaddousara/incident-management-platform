import { useState } from 'react';
import { INCIDENTS, CATEGORIES, LIEUX } from '../mock.js';
import { StatutBadge } from '../ui.jsx';

export default function MesIncidents() {
  const [incidents, setIncidents] = useState(INCIDENTS.slice(0, 3)); // mock
  const [form, setForm] = useState({ titre: '', categorie: CATEGORIES[0], lieu: LIEUX[0], description: '' });
  const [fichier, setFichier] = useState(null);
  const [msg, setMsg] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  function envoyer(e) {
    e.preventDefault();
    if (!form.titre.trim() || !form.description.trim()) return setMsg('Le titre et la description sont obligatoires.');
    setIncidents([{ id: Date.now() % 100000, ...form, statut: 'Nouveau', technicien: null, date: new Date().toISOString().slice(0, 10) }, ...incidents]);
    setForm({ titre: '', categorie: CATEGORIES[0], lieu: LIEUX[0], description: '' });
    setFichier(null);
    setMsg('Incident signalé.');
  }

  return (
    <>
      <h1>Mes incidents</h1>
      <section className="card">
        <h2>Signaler un incident</h2>
        <form onSubmit={envoyer} className="grid">
          <label className="full">Titre<input value={form.titre} onChange={set('titre')} /></label>
          <label>Catégorie
            <select value={form.categorie} onChange={set('categorie')}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
          </label>
          <label>Lieu
            <select value={form.lieu} onChange={set('lieu')}>{LIEUX.map((l) => <option key={l}>{l}</option>)}</select>
          </label>
          <label className="full">Description<textarea rows="3" value={form.description} onChange={set('description')} /></label>
          <label className="full">Pièce jointe (facultatif)
            <input type="file" accept="image/*,.pdf" onChange={(e) => setFichier(e.target.files[0] ?? null)} />
          </label>
          {fichier && <p className="muted full">Fichier choisi : {fichier.name}</p>}
          <div className="full row">
            <button className="btn">Envoyer le signalement</button>
            {msg && <span className="muted" role="status">{msg}</span>}
          </div>
        </form>
      </section>

      <section className="card">
        <h2>Suivi</h2>
        <table>
          <thead><tr><th>N°</th><th>Titre</th><th>Lieu</th><th>Date</th><th>Statut</th></tr></thead>
          <tbody>
            {incidents.map((i) => (
              <tr key={i.id}><td>{i.id}</td><td>{i.titre}</td><td>{i.lieu}</td><td>{i.date}</td><td><StatutBadge s={i.statut} /></td></tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
