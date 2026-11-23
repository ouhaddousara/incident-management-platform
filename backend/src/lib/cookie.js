const config = require('../config');

// Options du cookie de session, communes à la connexion, à la déconnexion et au nettoyage.
// sameSite 'none' exige secure (HTTPS) : sans cela le navigateur refuse le cookie.
function cookieOptions() {
  const sameSite = ['lax', 'strict', 'none'].includes(config.cookie.sameSite) ? config.cookie.sameSite : 'lax';
  return {
    httpOnly: true,
    sameSite,
    secure: sameSite === 'none' ? true : config.cookie.secure,
    maxAge: config.cookie.maxAgeMs,
    path: '/',
  };
}

module.exports = { cookieOptions };
