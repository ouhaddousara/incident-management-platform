import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuth, HOME } from './AuthContext.jsx';
import Layout from './Layout.jsx';
import Login from './pages/Login.jsx';
import MesIncidents from './pages/MesIncidents.jsx';
import Technicien from './pages/Technicien.jsx';
import Superviseur from './pages/Superviseur.jsx';
import Admin from './pages/Admin.jsx';

// Garde de routes : 401 -> connexion, mauvais rôle -> page d'accueil du rôle.
function RequireRole({ roles }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="center">Chargement…</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to={HOME[user.role] ?? '/login'} replace />;
  return <Outlet />;
}

function Accueil() {
  const { user, loading } = useAuth();
  if (loading) return <p className="center">Chargement…</p>;
  return <Navigate to={user ? HOME[user.role] ?? '/login' : '/login'} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Accueil />} />
      <Route path="/login" element={<Login />} />
      <Route element={<Layout />}>
        <Route element={<RequireRole roles={['etudiant', 'enseignant']} />}>
          <Route path="/mes-incidents" element={<MesIncidents />} />
        </Route>
        <Route element={<RequireRole roles={['technicien']} />}>
          <Route path="/technicien" element={<Technicien />} />
        </Route>
        <Route element={<RequireRole roles={['superviseur']} />}>
          <Route path="/superviseur" element={<Superviseur />} />
        </Route>
        <Route element={<RequireRole roles={['admin']} />}>
          <Route path="/admin" element={<Admin />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
