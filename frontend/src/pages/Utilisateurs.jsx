import { Comptes } from './adminParts.jsx';

export default function Utilisateurs() {
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Utilisateurs</h1>
          <p>Créez, modifiez et activez ou désactivez les comptes.</p>
        </div>
      </div>
      <Comptes />
    </>
  );
}
