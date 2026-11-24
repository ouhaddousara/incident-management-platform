import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../AuthContext.jsx';

const ROLES = {
  etudiant: 'Étudiant', enseignant: 'Enseignant', technicien: 'Technicien',
  superviseur: 'Superviseur', admin: 'Administrateur',
};

const liste = (d) => (Array.isArray(d) ? d : d?.items ?? d?.utilisateurs ?? []);
const nomComplet = (u) => `${u.prenom ?? ''} ${u.nom ?? ''}`.trim() || u.email;
const initiales = (nom = '') =>
  nom.split(' ').filter(Boolean).slice(0, 2).map((m) => m[0].toUpperCase()).join('');

/* ---------- Comptes ---------- */
const VIDE = { nom: '', prenom: '', email: '', role: 'etudiant', mot_de_passe: '' };

export function Comptes() {
  const { user: moi } = useAuth();
  const [users, setUsers] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');
  const [msg, setMsg] = useState('');
  const [form, setForm] = useState(VIDE);
  const [busy, setBusy] = useState(false);
  const [recherche, setRecherche] = useState('');
  const [filtre, setFiltre] = useState('');
  const [edit, setEdit] = useState(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const setE = (k) => (e) => setEdit({ ...edit, [k]: e.target.value });

  const charger = () => api.utilisateurs().then((d) => setUsers(liste(d))).catch((e) => setErreur(e.message));
  useEffect(() => { charger().finally(() => setChargement(false)); }, []);

  async function creer(e) {
    e.preventDefault();
    setErreur(''); setMsg('');
    if (!form.nom.trim() || !form.prenom.trim() || !form.email.trim()) return setErreur('Nom, prénom et e-mail sont obligatoires.');
    if (form.mot_de_passe.length < 8 || form.mot_de_passe.length > 72) return setErreur('Le mot de passe doit contenir de 8 à 72 caractères.');
    setBusy(true);
    try {
      await api.creerUtilisateur({ ...form, nom: form.nom.trim(), prenom: form.prenom.trim(), email: form.email.trim() });
      setForm(VIDE);
      setMsg('Compte créé.');
      await charger();
    } catch (err) {
      setErreur(err.message);
    } finally {
      setBusy(false);
    }
    return undefined;
  }

  async function modifier(u, changes) {
    setErreur(''); setMsg('');
    try {
      await api.majUtilisateur(u.id, changes);
      await charger();
    } catch (err) {
      setErreur(err.message);
    }
  }

  async function sauvegarder(e) {
    e.preventDefault();
    setErreur(''); setMsg('');
    const original = users.find((u) => u.id === edit.id) ?? {};
    const changes = {};
    ['prenom', 'nom', 'email'].forEach((k) => {
      const v = edit[k].trim();
      if (v && v !== (original[k] ?? '')) changes[k] = v;
    });
    if (edit.mot_de_passe) {
      if (edit.mot_de_passe.length < 8 || edit.mot_de_passe.length > 72) {
        return setErreur('Le mot de passe doit contenir de 8 à 72 caractères.');
      }
      changes.mot_de_passe = edit.mot_de_passe;
    }
    if (Object.keys(changes).length === 0) return setEdit(null);
    try {
      await api.majUtilisateur(edit.id, changes);
      setEdit(null);
      setMsg('Compte modifié.');
      await charger();
    } catch (err) {
      setErreur(err.message);
    }
    return undefined;
  }

  const stats = [
    ['Comptes', users.length, 'neutral'],
    ['Actifs', users.filter((u) => u.actif).length, 'ok'],
    ['Désactivés', users.filter((u) => !u.actif).length, 'warn'],
    ['Techniciens', users.filter((u) => u.role === 'technicien').length, 'info'],
  ];

  const visibles = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return users.filter((u) =>
      (!filtre || u.role === filtre) &&
      (!q || `${u.nom} ${u.prenom ?? ''} ${u.email}`.toLowerCase().includes(q)));
  }, [users, recherche, filtre]);

  return (
    <>
      {erreur && <p className="error" role="alert">{erreur}</p>}
      {msg && <p className="success" role="status">{msg}</p>}

      <div className="stats">
        {stats.map(([label, n, tone]) => (
          <div className={`card stat ${tone}`} key={label}><strong>{n}</strong><span>{label}</span></div>
        ))}
      </div>

      <section className="card">
        <h2>Créer un compte</h2>
        <form onSubmit={creer} className="grid">
          <label>Prénom<input value={form.prenom} onChange={set('prenom')} /></label>
          <label>Nom<input value={form.nom} onChange={set('nom')} /></label>
          <label>Adresse e-mail<input type="email" value={form.email} onChange={set('email')} /></label>
          <label>Rôle
            <select value={form.role} onChange={set('role')}>
              {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="full">Mot de passe (8 à 72 caractères)
            <input type="password" value={form.mot_de_passe} onChange={set('mot_de_passe')} autoComplete="new-password" />
          </label>
          <div className="full"><button className="btn" disabled={busy}>{busy ? 'Création…' : 'Créer le compte'}</button></div>
        </form>
      </section>

      {edit && (
        <section className="card">
          <h2>Modifier le compte</h2>
          <form onSubmit={sauvegarder} className="grid">
            <label>Prénom<input value={edit.prenom} onChange={setE('prenom')} /></label>
            <label>Nom<input value={edit.nom} onChange={setE('nom')} /></label>
            <label>Adresse e-mail<input type="email" value={edit.email} onChange={setE('email')} /></label>
            <label>Nouveau mot de passe (laisser vide pour ne pas changer)
              <input type="password" value={edit.mot_de_passe} onChange={setE('mot_de_passe')} autoComplete="new-password" />
            </label>
            <div className="full row">
              <button className="btn">Enregistrer</button>
              <button type="button" className="btn ghost" onClick={() => setEdit(null)}>Annuler</button>
            </div>
          </form>
        </section>
      )}

      <section className="card">
        <div className="card-head">
          <h2>Comptes</h2>
          <div className="toolbar">
            <input type="search" placeholder="Rechercher un nom, un e-mail…" value={recherche} onChange={(e) => setRecherche(e.target.value)} aria-label="Rechercher" />
            <select value={filtre} onChange={(e) => setFiltre(e.target.value)} aria-label="Filtrer par rôle">
              <option value="">Tous les rôles</option>
              {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>
        {chargement ? (
          <p className="center">Chargement…</p>
        ) : visibles.length === 0 ? (
          <div className="empty"><strong>Aucun compte</strong>Aucun résultat pour ces critères.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Utilisateur</th><th>E-mail</th><th>Rôle</th><th>État</th><th></th></tr></thead>
              <tbody>
                {visibles.map((u) => {
                  const soi = u.id === moi.id;
                  return (
                    <tr key={u.id}>
                      <td>
                        <div className="user-cell">
                          <span className="avatar">{initiales(nomComplet(u))}</span>
                          <span className="cell-title">{nomComplet(u)}{soi && <span className="muted"> (vous)</span>}</span>
                        </div>
                      </td>
                      <td className="muted">{u.email}</td>
                      <td>
                        <select value={u.role} disabled={soi || u.role === 'technicien'} onChange={(e) => modifier(u, { role: e.target.value })} aria-label="Rôle">
                          {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                      </td>
                      <td><span className={`badge ${u.actif ? 'b-ok' : 'b-new'}`}>{u.actif ? 'Actif' : 'Désactivé'}</span></td>
                      <td>
                        <button className="btn ghost small" onClick={() => setEdit({ id: u.id, prenom: u.prenom ?? '', nom: u.nom ?? '', email: u.email ?? '', mot_de_passe: '' })}>Modifier</button>{' '}
                        <button className={`btn small ${u.actif ? 'soft-danger' : 'soft-ok'}`} disabled={soi} onClick={() => modifier(u, { actif: !u.actif })}>
                          {u.actif ? 'Désactiver' : 'Réactiver'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

/* ---------- Catégories et lieux ---------- */
export function Referentiel({ nom, charger, creer, maj }) {
  const [items, setItems] = useState([]);
  const [libelle, setLibelle] = useState('');
  const [edit, setEdit] = useState(null); // { id, libelle }
  const [erreur, setErreur] = useState('');
  const [chargement, setChargement] = useState(true);

  const recharger = () => charger().then((d) => setItems(liste(d))).catch((e) => setErreur(e.message));
  useEffect(() => { recharger().finally(() => setChargement(false)); }, []); // eslint-disable-line

  async function ajouter(e) {
    e.preventDefault();
    if (!libelle.trim()) return setErreur('Le libellé est obligatoire.');
    setErreur('');
    try { await creer(libelle.trim()); setLibelle(''); await recharger(); }
    catch (err) { setErreur(err.message); }
    return undefined;
  }

  async function modifier(id, changes) {
    setErreur('');
    try { await maj(id, changes); setEdit(null); await recharger(); }
    catch (err) { setErreur(err.message); }
  }

  return (
    <>
      {erreur && <p className="error" role="alert">{erreur}</p>}
      <section className="card">
        <h2>Ajouter {nom.article}</h2>
        <form onSubmit={ajouter} className="inline-form">
          <label>Libellé<input value={libelle} onChange={(e) => setLibelle(e.target.value)} /></label>
          <button className="btn">Ajouter</button>
        </form>
      </section>

      <section className="card">
        <h2>{nom.titre}</h2>
        {chargement ? (
          <p className="center">Chargement…</p>
        ) : items.length === 0 ? (
          <div className="empty"><strong>Aucun élément</strong>Ajoutez-en un ci-dessus.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Libellé</th><th>État</th><th></th></tr></thead>
              <tbody>
                {items.map((it) => {
                  const actif = it.actif !== false;
                  const enEdition = edit?.id === it.id;
                  return (
                    <tr key={it.id}>
                      <td>
                        {enEdition
                          ? <input value={edit.libelle} onChange={(e) => setEdit({ ...edit, libelle: e.target.value })} style={{ margin: 0 }} autoFocus />
                          : <span className="cell-title">{it.libelle}</span>}
                      </td>
                      <td><span className={`badge ${actif ? 'b-ok' : 'b-done'}`}>{actif ? 'Actif' : 'Désactivé'}</span></td>
                      <td>
                        <div className="row" style={{ gap: '.5rem', flexWrap: 'wrap' }}>
                          {enEdition ? (
                            <>
                              <button className="btn small" onClick={() => modifier(it.id, { libelle: edit.libelle.trim() })}>Enregistrer</button>
                              <button className="btn ghost small" onClick={() => setEdit(null)}>Annuler</button>
                            </>
                          ) : (
                            <>
                              <button className="btn ghost small" onClick={() => setEdit({ id: it.id, libelle: it.libelle })}>Renommer</button>
                              <button className={`btn small ${actif ? 'soft-danger' : 'soft-ok'}`} onClick={() => modifier(it.id, { actif: !actif })}>
                                {actif ? 'Désactiver' : 'Réactiver'}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
