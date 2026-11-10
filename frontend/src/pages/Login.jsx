import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth, HOME } from '../AuthContext.jsx';

export default function Login() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!loading && user) return <Navigate to={HOME[user.role] ?? '/'} replace />;

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) return setError('Saisissez votre e-mail et votre mot de passe.');
    setBusy(true);
    try {
      const redirection = await login(email.trim(), password);
      navigate(redirection, { replace: true });
    } catch (err) {
      setError(err.message); // 400, 401, 403 (compte désactivé), 429 : messages fournis par l'API
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="card login" onSubmit={onSubmit} noValidate>
        <h1>Connexion à HelpDesk</h1>
        <p className="muted">Signalez et suivez les incidents techniques de l'établissement.</p>
        <label>Adresse e-mail
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" autoFocus />
        </label>
        <label>Mot de passe
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn" disabled={busy}>{busy ? 'Connexion…' : 'Se connecter'}</button>
      </form>
    </div>
  );
}
