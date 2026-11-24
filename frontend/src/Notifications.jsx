import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from './api.js';
import { fmtDate } from './ui.jsx';

export default function Notifications() {
  const [data, setData] = useState({ non_lues: 0, items: [] });
  const [ouvert, setOuvert] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  const charger = useCallback(
    () => api.notifications({ limit: 20 }).then(setData).catch(() => {}),
    [],
  );

  // Rafraîchissement toutes les 30 secondes.
  useEffect(() => {
    charger();
    const t = setInterval(charger, 30000);
    return () => clearInterval(t);
  }, [charger]);

  // Fermer le menu au clic à l'extérieur.
  useEffect(() => {
    const clic = (e) => { if (ref.current && !ref.current.contains(e.target)) setOuvert(false); };
    document.addEventListener('mousedown', clic);
    return () => document.removeEventListener('mousedown', clic);
  }, []);

  async function ouvrir(n) {
    setOuvert(false);
    if (!n.lue) { await api.notificationLue(n.id).catch(() => {}); charger(); }
    if (n.incident_id) navigate(`/incidents/${n.incident_id}`);
  }

  async function toutLire() {
    await api.notificationsLues().catch(() => {});
    charger();
  }

  return (
    <div className="bell-wrap" ref={ref}>
      <button
        className="bell"
        aria-label={`Notifications (${data.non_lues} non lues)`}
        onClick={() => { setOuvert(!ouvert); if (!ouvert) charger(); }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {data.non_lues > 0 && <span className="bell-count">{data.non_lues > 9 ? '9+' : data.non_lues}</span>}
      </button>

      {ouvert && (
        <div className="dropdown" role="menu">
          <div className="dropdown-head">
            <span>Notifications</span>
            {data.non_lues > 0 && <button className="link-btn" onClick={toutLire}>Tout marquer comme lu</button>}
          </div>
          {data.items.length === 0 ? (
            <div className="empty">Aucune notification.</div>
          ) : (
            <div className="notif-list">
              {data.items.map((n) => (
                <button key={n.id} className={`notif ${n.lue ? '' : 'non-lue'}`} onClick={() => ouvrir(n)}>
                  {n.message}
                  <small>{fmtDate(n.cree_le)}</small>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
