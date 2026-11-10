const jwt = require('jsonwebtoken');
const config = require('../config');
const asyncHandler = require('../lib/asyncHandler');
const { findById, publicUser } = require('../lib/users');

// 401 : pas (ou plus) connecté.
const requireAuth = asyncHandler(async (req, res, next) => {
  const token = req.cookies && req.cookies[config.cookie.name];
  if (!token) return res.status(401).json({ error: 'NON_AUTHENTIFIE', message: 'Connexion requise.' });

  let payload;
  try {
    payload = jwt.verify(token, config.sessionSecret, { algorithms: ['HS256'] });
  } catch {
    res.clearCookie(config.cookie.name);
    return res.status(401).json({ error: 'SESSION_INVALIDE', message: 'Session expirée, reconnectez-vous.' });
  }

  // On relit l'utilisateur à chaque requête : un compte désactivé (RG15) ou un rôle modifié est pris en compte tout de suite.
  const user = await findById(payload.sub);
  if (!user || !user.actif || !user.role) {
    res.clearCookie(config.cookie.name);
    return res.status(401).json({ error: 'SESSION_INVALIDE', message: 'Session expirée, reconnectez-vous.' });
  }
  req.user = publicUser(user);
  next();
});

// 403 : connecté, mais le rôle n'a pas le droit. À placer APRÈS requireAuth.
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'ACCES_INTERDIT', message: 'Vous n\'avez pas les droits pour cette action.' });
  }
  next();
};

module.exports = { requireAuth, requireRole };
