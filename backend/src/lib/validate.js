const { HttpError } = require('./httpError');

// Texte nettoyé (espaces retirés) ou null s'il est vide / trop long / absent.
function text(value, max) {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (!v || v.length > max) return null;
  return v;
}

// Entier strictement positif (identifiant) ou null.
function toId(value) {
  const n = typeof value === 'string' && /^\d{1,12}$/.test(value.trim()) ? Number(value) : value;
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

// Identifiant dans l'URL : 400 si ce n'est pas un nombre.
function paramId(value) {
  const id = toId(value);
  if (!id) throw new HttpError(400, 'IDENTIFIANT_INVALIDE', 'Identifiant invalide.');
  return id;
}

const URGENCES = { faible: 'FAIBLE', moyen: 'MOYEN', moyenne: 'MOYEN', eleve: 'ELEVE', elevee: 'ELEVE' };
// Accepte FAIBLE / MOYEN / ELEVE en majuscules ou minuscules, avec ou sans accent. Défaut : MOYEN (décision d'équipe).
function urgence(value) {
  if (value === undefined || value === null || value === '') return 'MOYEN';
  const key = String(value).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return URGENCES[key] || null;
}

const STATUTS = ['SIGNALE', 'EXAMINE', 'AFFECTE', 'EN_COURS', 'RESOLU', 'NON_RESOLU', 'CLOTURE'];

// Date AAAA-MM-JJ valide ou null.
function isoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value ? null : value;
}

function bool(value) {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === 1 || value === '1') return true;
  if (value === 'false' || value === 0 || value === '0') return false;
  return null;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

module.exports = { text, toId, paramId, urgence, STATUTS, isoDate, bool, EMAIL };
