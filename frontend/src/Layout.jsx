import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';

const ROLE_LABEL = {
  etudiant: 'Étudiant', enseignant: 'Enseignant', technicien: 'Technicien',
  superviseur: 'Superviseur', admin: 'Administrateur',
};

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  if (!user) return <Outlet />;

  return (
    <div className="shell">
      <header className="topbar">
        <strong className="brand">HelpDesk</strong>
        <div className="who">
          <span>{user.nom} <em>({ROLE_LABEL[user.role] ?? user.role})</em></span>
          <button className="btn ghost" onClick={async () => { await logout(); navigate('/login'); }}>
            Se déconnecter
          </button>
        </div>
      </header>
      <main className="content"><Outlet /></main>
    </div>
  );
}
