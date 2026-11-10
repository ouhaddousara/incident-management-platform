const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const config = require('./config');
const { translateDbError } = require('./lib/errors');

const app = express();
if (config.trustProxy) app.set('trust proxy', 1);

app.use(helmet());
app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

app.use(require('./routes/health'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api', require('./routes/protected'));

app.use((req, res) => res.status(404).json({ error: 'INTROUVABLE', message: 'Route inconnue.' }));

// Gestionnaire d'erreurs : traduit les erreurs de règles (RGxx) de la base, sinon 500 sans détail technique.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON_INVALIDE', message: 'Requête mal formée.' });
  const translated = translateDbError(err);
  if (translated) return res.status(translated.status).json(translated.body);
  console.error(err);
  res.status(500).json({ error: 'ERREUR_SERVEUR', message: 'Une erreur est survenue.' });
});

module.exports = app;
