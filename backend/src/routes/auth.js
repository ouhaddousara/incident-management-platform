const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const asyncHandler = require('../lib/asyncHandler');
const { findByEmail, publicUser } = require('../lib/users');
const { HOME } = require('../lib/roles');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Hash factice : on fait toujours une comparaison bcrypt, même si l'e-mail n'existe pas
// (évite de révéler quels e-mails existent grâce au temps de réponse).
const DUMMY_HASH = bcrypt.hashSync('mot-de-passe-factice', 10);

// Anti force brute simple (en mémoire) : 5 échecs / 15 min par IP + e-mail.
const attempts = new Map();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const isBlocked = (key) => {
  const e = attempts.get(key);
  if (!e) return false;
  if (Date.now() - e.first > WINDOW_MS) { attempts.delete(key); return false; }
  return e.count >= MAX_ATTEMPTS;
};
const registerFailure = (key) => {
  const e = attempts.get(key);
  if (!e || Date.now() - e.first > WINDOW_MS) attempts.set(key, { count: 1, first: Date.now() });
  else e.count += 1;
};

const cookieOptions = () => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: config.cookie.secure,
  maxAge: config.cookie.maxAgeMs,
  path: '/',
});

const withRedirect = (user) => ({ user: publicUser(user), redirection: HOME[user.role] });

// POST /api/auth/login
router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};
  if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
    return res.status(400).json({ error: 'CHAMPS_OBLIGATOIRES', message: 'E-mail et mot de passe obligatoires.' });
  }
  if (email.length > 254 || password.length > 200) {
    return res.status(400).json({ error: 'CHAMPS_INVALIDES', message: 'Champs trop longs.' });
  }

  const key = `${req.ip}|${email.trim().toLowerCase()}`;
  if (isBlocked(key)) {
    return res.status(429).json({ error: 'TROP_DE_TENTATIVES', message: 'Trop de tentatives. Réessayez dans quelques minutes.' });
  }

  const user = await findByEmail(email.trim());
  const passwordOk = await bcrypt.compare(password, user ? user.hash : DUMMY_HASH);

  if (!user || !passwordOk) {
    registerFailure(key);
    return res.status(401).json({ error: 'IDENTIFIANTS_INCORRECTS', message: 'E-mail ou mot de passe incorrect.' });
  }
  if (!user.actif) {
    // RG15 : message distinct, mais seulement après un mot de passe correct.
    return res.status(403).json({ error: 'COMPTE_DESACTIVE', message: 'Ce compte est désactivé. Contactez l\'administrateur.' });
  }
  if (!user.role) {
    return res.status(403).json({ error: 'ROLE_INCONNU', message: 'Aucun rôle valide pour ce compte.' });
  }

  attempts.delete(key);
  const token = jwt.sign({ sub: user.id }, config.sessionSecret, { algorithm: 'HS256', expiresIn: Math.floor(config.cookie.maxAgeMs / 1000) });
  res.cookie(config.cookie.name, token, cookieOptions());
  res.json(withRedirect(user));
}));

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie(config.cookie.name, { ...cookieOptions(), maxAge: undefined });
  res.json({ message: 'Déconnecté.' });
});

// GET /api/auth/me  (utilisé par le Front pour savoir qui est connecté et où rediriger)
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user, redirection: HOME[req.user.role] });
});

module.exports = router;
