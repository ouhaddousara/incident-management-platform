require('dotenv').config();

const required = (name) => {
  if (!process.env[name]) throw new Error(`Variable d'environnement manquante : ${name}`);
  return process.env[name];
};

const env = process.env.NODE_ENV || 'development';

module.exports = {
  env,
  port: Number(process.env.PORT || 3000),
  databaseUrl:
    process.env.DATABASE_URL ||
    `postgresql://${process.env.APP_DB_USER || 'helpdesk_app'}:${encodeURIComponent(
      required('APP_DB_PASSWORD')
    )}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'helpdesk'}`,
  sessionSecret: required('SESSION_SECRET'),
  cookie: {
    name: 'helpdesk_session',
    maxAgeMs: 8 * 60 * 60 * 1000, // 8 heures
    secure: process.env.COOKIE_SECURE === 'true' || env === 'production',
    // 'lax' si le site et l'API ont la même adresse ; 'none' (avec HTTPS) si elles sont différentes
    sameSite: (process.env.COOKIE_SAMESITE || 'lax').toLowerCase(),
  },
  // Connexion à la base hébergée : DB_SSL=true active TLS ; DB_SSL_INSECURE=true accepte un certificat non vérifié
  dbSsl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: process.env.DB_SSL_INSECURE !== 'true' } : false,
  uploadDir: process.env.UPLOAD_DIR || require('path').join(__dirname, '..', 'uploads'),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  trustProxy: process.env.TRUST_PROXY === '1',
};
