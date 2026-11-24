import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import { LISTE } from '../nav.js';
import { StatutBadge, UrgenceBadge, STATUTS, fmtDate } from '../ui.jsx';

// Chaque action : libellé + champs demandés [nom, obligatoire].
const ACTIONS = {
  'examiner':          { label: 'Examiner',               champs: [['remarque', false]] },
  'rejeter':           { label: 'Rejeter',                champs: [['motif', true]], danger: true },
  'doublon':           { label: 'Marquer comme doublon',  champs: [['doublon_de_id', true], ['motif', false]], danger: true },
  'affecter':          { label: 'Affecter',               champs: [['technicien_id', true], ['remarque', false]] },
  'reaffecter':        { label: 'Réaffecter',             champs: [['technicien_id', true], ['remarque', false]] },
  'rouvrir':           { label: 'Rouvrir',                champs: [['technicien_id', true], ['remarque', false]] },
  'cloturer':          { label: 'Clôturer',               champs: [['remarque', false]] },
  'prendre-en-charge': { label: 'Prendre en charge',      champs: [] },
  'resoudre':          { label: 'Marquer comme résolu',   champs: [['remarque', false]] },
  'non-resolu':        { label: 'Non résolu',             champs: [['remarque', true]], danger: true },
};

const CHAMPS = {
  remarque: 'Remarque',
  motif: 'Motif',
  doublon_de_id: "N° de l'incident d'origine",
  technicien_id: 'Technicien',
};

export default function IncidentDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [inc, setInc] = useState(null);
  const [erreur, setErreur] = useState('');
  const [msg, setMsg] = useState('');
  const [choix, setChoix] = useState(null);
  const [valeurs, setValeurs] = useState({});
  const [techs, setTechs] = useState([]);
  const [busy, setBusy] = useState(false);
  const [photoUrl, setPhotoUrl] = useState(null);

  useEffect(() => {
    setInc(null);
    api.incident(id).then(setInc).catch((e) => setErreur(e.message));
  }, [id]);

  // La photo demande le cookie : on la charge en blob.
  useEffect(() => {
    if (!inc?.piece_jointe) { setPhotoUrl(null); return undefined; }
    let url;
    let annule = false;
    api.photo(id)
      .then((b) => { if (!annule) { url = URL.createObjectURL(b); setPhotoUrl(url); } })
      .catch(() => {});
    return () => { annule = true; if (url) URL.revokeObjectURL(url); };
  }, [id, inc?.piece_jointe?.id]);

  if (!inc) {
    return erreur ? <p className="error" role="alert">{erreur}</p> : <p className="center">Chargement…</p>;
  }

  const maj = (nom) => (e) => setValeurs({ ...valeurs, [nom]: e.target.value });
  const actions = (inc.actions ?? []).map((a) => a.replace(/_/g, '-')).filter((a) => ACTIONS[a]);

  async function executer(nom, body) {
    setBusy(true); setErreur(''); setMsg('');
    try {
      const data = await api.action(id, nom, body);
      setInc(data);
      setChoix(null);
      setValeurs({});
      setMsg('Action effectuée.');
    } catch (e) {
      setErreur(e.message);
    } finally {
      setBusy(false);
    }
  }

  function ouvrir(nom) {
    setErreur(''); setMsg('');
    const cfg = ACTIONS[nom];
    if (cfg.champs.length === 0) return executer(nom, {});
    setChoix(nom);
    setValeurs({});
    if (cfg.champs.some(([c]) => c === 'technicien_id') && techs.length === 0) {
      api.techniciens().then(setTechs).catch((e) => setErreur(e.message));
    }
    return undefined;
  }

  function valider(e) {
    e.preventDefault();
    const body = {};
    for (const [nom, requis] of ACTIONS[choix].champs) {
      const v = (valeurs[nom] ?? '').toString().trim();
      if (!v) {
        if (requis) return setErreur(`Champ obligatoire : ${CHAMPS[nom]}.`);
        continue;
      }
      body[nom] = nom.endsWith('_id') ? Number(v) : v;
    }
    return executer(choix, body);
  }

  async function envoyerPhoto(e) {
    const f = e.target.files[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) return setErreur('La photo ne doit pas dépasser 5 Mo.');
    setErreur(''); setMsg('');
    try {
      await api.envoyerPhoto(id, f);
      setInc(await api.incident(id));
      setMsg('Photo ajoutée.');
    } catch (err) {
      setErreur(err.message);
    }
    return undefined;
  }

  const peutAjouterPhoto =
    ['etudiant', 'enseignant'].includes(user.role) && inc.statut === 'SIGNALE' && !inc.piece_jointe;
  const aff = inc.affectation_active;

  return (
    <>
      <p><Link to={LISTE[user.role] ?? '/dashboard'} className="muted">← Retour à la liste</Link></p>

      <div className="page-head">
        <div>
          <h1>Incident #{inc.id}</h1>
          <p>{inc.titre}</p>
        </div>
        <div className="row"><UrgenceBadge u={inc.urgence} /><StatutBadge s={inc.statut} /></div>
      </div>

      {erreur && <p className="error" role="alert">{erreur}</p>}
      {msg && <p className="success" role="status">{msg}</p>}

      <section className="card">
        <h2>Détails</h2>
        <div className="grid">
          <p><span className="muted">Catégorie</span><br />{inc.categorie}</p>
          <p><span className="muted">Lieu</span><br />{inc.lieu}</p>
          <p><span className="muted">Déclarant</span><br />{inc.declarant}</p>
          <p><span className="muted">Technicien</span><br />{aff?.technicien ?? inc.technicien ?? 'Non affecté'}</p>
          <p><span className="muted">Créé le</span><br />{fmtDate(inc.cree_le)}</p>
          <p><span className="muted">Dernière mise à jour</span><br />{fmtDate(inc.mis_a_jour_le)}</p>
          <p className="full"><span className="muted">Description</span><br />{inc.description}</p>
          {inc.doublon_de_id && (
            <p className="full"><span className="muted">Doublon de</span><br />
              <Link to={`/incidents/${inc.doublon_de_id}`}>Incident #{inc.doublon_de_id}</Link>
            </p>
          )}
        </div>
      </section>

      {actions.length > 0 && (
        <section className="card">
          <h2>Actions</h2>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            {actions.map((a) => (
              <button key={a} className={`btn ${ACTIONS[a].danger ? 'soft-danger' : ''}`} disabled={busy} onClick={() => ouvrir(a)}>
                {ACTIONS[a].label}
              </button>
            ))}
          </div>

          {choix && (
            <form onSubmit={valider} style={{ marginTop: '1rem' }}>
              <h2>{ACTIONS[choix].label}</h2>
              {ACTIONS[choix].champs.map(([nom, requis]) => (
                <label key={nom}>{CHAMPS[nom]}{requis ? ' *' : ' (facultatif)'}
                  {nom === 'technicien_id' ? (
                    <select value={valeurs[nom] ?? ''} onChange={maj(nom)}>
                      <option value="">Choisir un technicien…</option>
                      {techs.map((t) => (
                        <option key={t.id} value={t.id} disabled={!t.disponible}>
                          {t.nom} — {t.charge ?? 0} en cours{t.disponible ? '' : ' (indisponible)'}
                        </option>
                      ))}
                    </select>
                  ) : nom === 'doublon_de_id' ? (
                    <input type="number" min="1" value={valeurs[nom] ?? ''} onChange={maj(nom)} />
                  ) : (
                    <textarea rows="2" value={valeurs[nom] ?? ''} onChange={maj(nom)} />
                  )}
                </label>
              ))}
              <div className="row">
                <button className="btn" disabled={busy}>{busy ? 'Envoi…' : 'Confirmer'}</button>
                <button type="button" className="btn ghost" onClick={() => setChoix(null)}>Annuler</button>
              </div>
            </form>
          )}
        </section>
      )}

      {(photoUrl || peutAjouterPhoto) && (
        <section className="card">
          <h2>Photo</h2>
          {photoUrl && <img src={photoUrl} alt="Pièce jointe de l'incident" style={{ maxWidth: '100%', maxHeight: 360, borderRadius: 8 }} />}
          {peutAjouterPhoto && (
            <label>Ajouter une photo (JPEG ou PNG, 5 Mo max)
              <input type="file" accept="image/jpeg,image/png" onChange={envoyerPhoto} />
            </label>
          )}
        </section>
      )}

      <section className="card">
        <h2>Historique</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Date</th><th>Changement</th><th>Auteur</th><th>Remarque</th></tr></thead>
            <tbody>
              {(inc.historique ?? []).map((h) => (
                <tr key={h.id}>
                  <td className="num">{fmtDate(h.date_heure)}</td>
                  <td>
                    {h.ancien_statut ? `${STATUTS[h.ancien_statut]?.label ?? h.ancien_statut} → ` : ''}
                    <strong>{STATUTS[h.nouveau_statut]?.label ?? h.nouveau_statut}</strong>
                  </td>
                  <td>{h.auteur}</td>
                  <td className="muted">{h.remarque ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
