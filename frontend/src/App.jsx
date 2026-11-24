import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuth, HOME } from './AuthContext.jsx';
import Layout from './Layout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import MesTickets from './pages/MesTickets.jsx';
import Interventions from './pages/Interventions.jsx';
import NouveauTicket from './pages/NouveauTicket.jsx';
import Incidents from './pages/Incidents.jsx';
import IncidentDetail from './pages/IncidentDetail.jsx';
import Utilisateurs from './pages/Utilisateurs.jsx';
import Statistiques from './pages/Statistiques.jsx';
import Parametres from './pages/Parametres.jsx';

const TOUS = ['etudiant', 'enseignant', 'technicien', 'superviseur', 'admin'];
const DECLARANTS = ['etudiant', 'enseignant'];
const GESTION = ['superviseur', 'admin'];

// Garde de routes : 401 -> connexion, mauvais rôle -> dashboard.
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

// « Mes tickets » : liste du déclarant, ou interventions du technicien.
function MesTicketsRoute() {
  const { user } = useAuth();
  return user.role === 'technicien' ? <Interventions /> : <MesTickets />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Accueil />} />
      <Route path="/login" element={<Login />} />

      {/* Anciennes adresses (l'API renvoie encore ces redirections après la connexion) */}
      {['/mes-incidents', '/technicien', '/superviseur', '/admin'].map((p) => (
        <Route key={p} path={p} element={<Navigate to="/dashboard" replace />} />
      ))}

      <Route element={<Layout />}>
        <Route element={<RequireRole roles={TOUS} />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/mes-tickets" element={<MesTicketsRoute />} />
          <Route path="/incidents/:id" element={<IncidentDetail />} />
          <Route path="/parametres" element={<Parametres />} />
        </Route>
        <Route element={<RequireRole roles={DECLARANTS} />}>
          <Route path="/nouveau-ticket" element={<NouveauTicket />} />
        </Route>
        <Route element={<RequireRole roles={GESTION} />}>
          <Route path="/incidents" element={<Incidents />} />
          <Route path="/rapports" element={<Statistiques />} />
        </Route>
        <Route element={<RequireRole roles={['admin']} />}>
          <Route path="/utilisateurs" element={<Utilisateurs />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
