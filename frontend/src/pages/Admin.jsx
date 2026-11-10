import { useState } from 'react';
import { UTILISATEURS, CATEGORIES, LIEUX } from '../mock.js';

export default function Admin() {
  const [users, setUsers] = useState(UTILISATEURS); // mock
  const toggle = (id) => setUsers(users.map((u) => (u.id === id ? { ...u, actif: !u.actif } : u)));

  return (
    <>
      <h1>Administration</h1>
      <section className="card">
        <h2>Comptes</h2>
        <table>
          <thead><tr><th>Nom</th><th>E-mail</th><th>Rôle</th><th>État</th><th></th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.nom}</td><td>{u.email}</td><td>{u.role}</td>
                <td>{u.actif ? 'Actif' : 'Désactivé'}</td>
                <td><button className="btn small" onClick={() => toggle(u.id)}>{u.actif ? 'Désactiver' : 'Réactiver'}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <div className="grid2">
        <section className="card"><h2>Catégories</h2><ul>{CATEGORIES.map((c) => <li key={c}>{c}</li>)}</ul></section>
        <section className="card"><h2>Lieux</h2><ul>{LIEUX.map((l) => <li key={l}>{l}</li>)}</ul></section>
      </div>
    </>
  );
}
