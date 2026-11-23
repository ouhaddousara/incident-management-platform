const { Pool, types } = require('pg');
const config = require('./config');

// Les colonnes bigint (identifiants, count) reviennent en nombres et non en chaînes de caractères.
types.setTypeParser(types.builtins.INT8, (v) => parseInt(v, 10));

const pool = new Pool({ connectionString: config.databaseUrl, max: 10, ssl: config.dbSsl });
pool.on('error', (err) => console.error('Erreur inattendue du pool PostgreSQL :', err.message));

const query = (text, params) => pool.query(text, params);

// Exécute fn(client) dans une transaction : COMMIT si tout réussit, ROLLBACK à la première erreur.
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (e) { /* connexion déjà perdue */ }
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, withTransaction };
