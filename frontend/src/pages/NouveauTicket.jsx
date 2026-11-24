import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';

export default function NouveauTicket() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [lieux, setLieux] = useState([]);
  const [form, setForm] = useState({ titre: '', categorie_id: '', lieu_id: '', urgence: 'MOYEN', description: '' });
  const [fichier, setFichier] = useState(null);
  const [erreur, setErreur] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  useEffect(() => {
    Promise.all([api.categories(), api.lieux()])
      .then(([c, l]) => {
        setCategories(c);
        setLieux(l);
        setForm((f) => ({ ...f, categorie_id: c[0]?.id ?? '', lieu_id: l[0]?.id ?? '' }));
      })
      .catch((e) => setErreur(e.message));
  }, []);

  async function envoyer(e) {
    e.preventDefault();
    setErreur('');
    if (!form.titre.trim() || !form.description.trim()) return setErreur('Le titre et la description sont obligatoires.');
    if (fichier && fichier.size > 5 * 1024 * 1024) return setErreur('La photo ne doit pas dépasser 5 Mo.');
    setBusy(true);
    try {
      const cree = await api.creerIncident({
        titre: form.titre.trim(),
        description: form.description.trim(),
        categorie_id: Number(form.categorie_id),
        lieu_id: Number(form.lieu_id),
        urgence: form.urgence,
      });
      if (fichier) {
        try { await api.envoyerPhoto(cree.id, fichier); } catch { /* la photo pourra être ajoutée depuis la fiche */ }
      }
      navigate(`/incidents/${cree.id}`);
    } catch (err) {
      setErreur(err.message);
      setBusy(false);
    }
    return undefined;
  }

  return (
    <>
      <p><Link to="/mes-tickets" className="muted">← Retour à mes tickets</Link></p>
      <div className="page-head">
        <div>
          <h1>Créer un ticket</h1>
          <p>Décrivez le problème pour qu'un technicien puisse intervenir rapidement.</p>
        </div>
      </div>

      <section className="card">
        {erreur && <p className="error" role="alert">{erreur}</p>}
        <form onSubmit={envoyer} className="grid">
          <label className="full">Titre<input value={form.titre} onChange={set('titre')} placeholder="Ex. : Projecteur en panne en salle B12" /></label>
          <label>Catégorie
            <select value={form.categorie_id} onChange={set('categorie_id')}>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.libelle}</option>)}
            </select>
          </label>
          <label>Lieu
            <select value={form.lieu_id} onChange={set('lieu_id')}>
              {lieux.map((l) => <option key={l.id} value={l.id}>{l.libelle}</option>)}
            </select>
          </label>
          <label>Urgence
            <select value={form.urgence} onChange={set('urgence')}>
              <option value="FAIBLE">Faible</option>
              <option value="MOYEN">Moyenne</option>
              <option value="ELEVE">Élevée</option>
            </select>
          </label>
          <label>Photo (facultatif, JPEG ou PNG, 5 Mo max)
            <input type="file" accept="image/jpeg,image/png" onChange={(e) => setFichier(e.target.files[0] ?? null)} />
          </label>
          <label className="full">Description
            <textarea rows="5" value={form.description} onChange={set('description')} placeholder="Décrivez le problème le plus précisément possible." />
          </label>
          <div className="full row">
            <button className="btn" disabled={busy}>{busy ? 'Envoi…' : 'Envoyer le ticket'}</button>
            <Link className="btn ghost" to="/mes-tickets">Annuler</Link>
          </div>
        </form>
      </section>
    </>
  );
}
