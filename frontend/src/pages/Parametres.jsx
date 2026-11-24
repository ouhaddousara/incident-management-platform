import { useState } from 'react';
import { useAuth } from '../AuthContext.jsx';
import { api } from '../api.js';
import { Disponibilite } from '../tickets.jsx';
import { Referentiel } from './adminParts.jsx';

const ROLE_LABEL = {
  etudiant: 'Étudiant', enseignant: 'Enseignant', technicien: 'Technicien',
  superviseur: 'Superviseur', admin: 'Administrateur',
};

export default function Parametres() {
  const { user } = useAuth();
  const [onglet, setOnglet] = useState('categories');

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Paramètres</h1>
          <p>Votre profil{user.role === 'admin' ? ', les catégories et les lieux.' : '.'}</p>
        </div>
      </div>

      <section className="card">
        <h2>Mon profil</h2>
        <dl className="info-list">
          <dt>Nom</dt><dd>{user.nom}</dd>
          <dt>Adresse e-mail</dt><dd>{user.email}</dd>
          <dt>Rôle</dt><dd><span className="role">{ROLE_LABEL[user.role] ?? user.role}</span></dd>
        </dl>
        <p className="muted" style={{ marginBottom: 0 }}>
          Pour modifier votre nom, votre e-mail ou votre mot de passe, contactez un administrateur.
        </p>
      </section>

      {user.role === 'technicien' && (
        <section className="card">
          <h2>Disponibilité</h2>
          <p className="muted">Un technicien indisponible ne peut pas recevoir de nouvelles affectations.</p>
          <Disponibilite />
        </section>
      )}

      {user.role === 'admin' && (
        <>
          <div className="tabs" role="tablist">
            {[['categories', 'Catégories'], ['lieux', 'Lieux']].map(([k, label]) => (
              <button key={k} role="tab" aria-selected={onglet === k} className={`tab ${onglet === k ? 'active' : ''}`} onClick={() => setOnglet(k)}>
                {label}
              </button>
            ))}
          </div>
          {onglet === 'categories' && (
            <Referentiel key="cat" nom={{ titre: 'Catégories', article: 'une catégorie' }}
              charger={api.adminCategories} creer={api.creerCategorie} maj={api.majCategorie} />
          )}
          {onglet === 'lieux' && (
            <Referentiel key="lieu" nom={{ titre: 'Lieux', article: 'un lieu' }}
              charger={api.adminLieux} creer={api.creerLieu} maj={api.majLieu} />
          )}
        </>
      )}
    </>
  );
}
