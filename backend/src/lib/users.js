const { query } = require('../db');
const { table, cols } = require('../schema');
const { normalizeRole } = require('./roles');

// Les noms de table/colonnes viennent de schema.js (constantes), jamais de l'utilisateur.
const SELECT = `SELECT ${cols.id} AS id, ${cols.prenom} || ' ' || ${cols.nom} AS nom, ${cols.email} AS email,
                       ${cols.hash} AS hash, ${cols.role} AS role, ${cols.actif} AS actif
                FROM ${table}`;

function toUser(row) {
  if (!row) return null;
  return { id: row.id, nom: row.nom, email: row.email, hash: row.hash, role: normalizeRole(row.role), actif: row.actif === true };
}

async function findByEmail(email) {
  const { rows } = await query(`${SELECT} WHERE lower(${cols.email}) = lower($1) LIMIT 1`, [email]);
  return toUser(rows[0]);
}

async function findById(id) {
  const { rows } = await query(`${SELECT} WHERE ${cols.id} = $1 LIMIT 1`, [id]);
  return toUser(rows[0]);
}

const publicUser = (u) => ({ id: u.id, nom: u.nom, email: u.email, role: u.role });

module.exports = { findByEmail, findById, publicUser };
