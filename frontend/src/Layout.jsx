import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';
import Notifications from './Notifications.jsx';
import { Icon } from './icons.jsx';
import { NAV, LISTE } from './nav.js';

const ROLE_LABEL = {
  etudiant: 'Étudiant', enseignant: 'Enseignant', technicien: 'Technicien',
  superviseur: 'Superviseur', admin: 'Administrateur',
};

const initiales = (nom = '') =>
  nom.split(' ').filter(Boolean).slice(0, 2).map((m) => m[0].toUpperCase()).join('');

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menu, setMenu] = useState(false);       // sidebar sur mobile
  const [profil, setProfil] = useState(false);   // menu du profil
  const [q, setQ] = useState('');
  const refProfil = useRef(null);

  // Fermer la sidebar mobile et le menu à chaque changement de page.
  useEffect(() => { setMenu(false); setProfil(false); }, [location.pathname]);

  useEffect(() => {
    const clic = (e) => { if (refProfil.current && !refProfil.current.contains(e.target)) setProfil(false); };
    document.addEventListener('mousedown', clic);
    return () => document.removeEventListener('mousedown', clic);
  }, []);

  if (!user) return <Outlet />;

  function rechercher(e) {
    e.preventDefault();
    const terme = q.trim();
    navigate(`${LISTE[user.role] ?? '/dashboard'}${terme ? `?q=${encodeURIComponent(terme)}` : ''}`);
  }

  return (
    <div className="layout">
      <aside className={`sidebar ${menu ? 'open' : ''}`}>
        <div className="side-brand"><span className="logo">H</span> HelpDesk</div>
        <nav className="side-nav" aria-label="Navigation principale">
          {(NAV[user.role] ?? []).map(([to, label, icone]) => (
            <NavLink key={to} to={to} className="side-link">
              <Icon name={icone} /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="side-foot">Gestion des incidents techniques</div>
      </aside>
      {menu && <div className="overlay" onClick={() => setMenu(false)} />}

      <div className="main">
        <header className="header">
          <button className="icon-btn menu-btn" onClick={() => setMenu(true)} aria-label="Ouvrir le menu">
            <Icon name="menu" />
          </button>

          <form className="search" onSubmit={rechercher} role="search">
            <Icon name="search" size={16} />
            <input type="search" placeholder="Rechercher un ticket…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher un ticket" />
          </form>

          <div className="header-right">
            <Notifications />
            <div className="profile" ref={refProfil}>
              <button className="profile-btn" onClick={() => setProfil(!profil)} aria-haspopup="menu" aria-expanded={profil}>
                <span className="avatar">{initiales(user.nom)}</span>
                <span className="who-info">
                  <strong>{user.nom}</strong>
                  <small>{ROLE_LABEL[user.role] ?? user.role}</small>
                </span>
                <Icon name="chevron" size={16} />
              </button>
              {profil && (
                <div className="dropdown" role="menu">
                  <Link to="/parametres" className="menu-item" role="menuitem"><Icon name="settings" size={16} /> Paramètres</Link>
                  <button className="menu-item" role="menuitem" onClick={async () => { await logout(); navigate('/login'); }}>
                    <Icon name="logout" size={16} /> Se déconnecter
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="content"><Outlet /></main>
      </div>
    </div>
  );
}
