const express = require('express');
const asyncHandler = require('../lib/asyncHandler');
const { query } = require('../db');
const { requireAuth } = require('../middleware/auth');

// Listes pour le formulaire de signalement (catégories et lieux actifs), lisibles par tout utilisateur connecté.
const router = express.Router();
router.use(requireAuth);

router.get('/categories', asyncHandler(async (req, res) => {
  const { rows } = await query('SELECT id, libelle FROM categorie WHERE actif ORDER BY libelle');
  res.json(rows);
}));
router.get('/lieux', asyncHandler(async (req, res) => {
  const { rows } = await query('SELECT id, libelle FROM lieu WHERE actif ORDER BY libelle');
  res.json(rows);
}));

module.exports = router;
