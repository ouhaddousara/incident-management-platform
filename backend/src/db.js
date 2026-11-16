const { Pool } = require('pg');
const config = require('./config');

const pool = new Pool({ connectionString: config.databaseUrl, max: 10 });
pool.on('error', (err) => console.error('Erreur inattendue du pool PostgreSQL :', err.message));

module.exports = { pool, query: (text, params) => pool.query(text, params) };
