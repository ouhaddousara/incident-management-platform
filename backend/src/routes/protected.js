const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');

// Routes de démonstration pour tester le contrôle d'accès (QA : « page protégée », droits par rôle).
// À remplacer progressivement par les vraies routes métier (mêmes middlewares).
const router = express.Router();
router.use(requireAuth);

router.get('/ping', (req, res) => res.json({ message: 'Authentifié', user: req.user }));
router.get('/superviseur/ping', requireRole('superviseur'), (req, res) => res.json({ message: 'Espace superviseur', user: req.user }));
router.get('/technicien/ping', requireRole('technicien'), (req, res) => res.json({ message: 'Espace technicien', user: req.user }));
router.get('/admin/ping', requireRole('admin'), (req, res) => res.json({ message: 'Espace administration', user: req.user }));
router.get('/declarant/ping', requireRole('etudiant', 'enseignant'), (req, res) => res.json({ message: 'Espace déclarant', user: req.user }));

module.exports = router;
