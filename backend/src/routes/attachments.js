const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const config = require('../config');
const asyncHandler = require('../lib/asyncHandler');
const { query } = require('../db');
const { requireRole } = require('../middleware/auth');
const { HttpError } = require('../lib/httpError');
const v = require('../lib/validate');
const { canView } = require('../lib/incidents');

// Monté sur /api/incidents/:id/piece-jointe (l'authentification est déjà faite par le routeur parent).
const router = express.Router({ mergeParams: true });

const MAX_BYTES = 5 * 1024 * 1024; // RG17 : 5 Mo maximum
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_BYTES, files: 1 } }).single('photo');

// On vérifie le contenu réel du fichier (JPEG ou PNG), pas seulement le type annoncé par le navigateur.
function detectType(buf) {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg' };
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buf.length >= 8 && buf.subarray(0, 8).equals(png)) return { mime: 'image/png', ext: 'png' };
  return null;
}

const safeName = (name) => String(name || 'photo').replace(/[^\w.\- ]/g, '_').slice(0, 100);

// POST : le déclarant ajoute sa photo (champ « photo », multipart) tant que l'incident est « Signalé ».
router.post('/', requireRole('etudiant', 'enseignant'), (req, res, next) => {
  upload(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') return next(new HttpError(400, 'RG17', 'Pièce jointe refusée : 5 Mo maximum.'));
    return next(new HttpError(400, 'FICHIER_INVALIDE', 'Envoi du fichier impossible (champ « photo » attendu).'));
  });
}, asyncHandler(async (req, res) => {
  const id = v.paramId(req.params.id);
  const { rows } = await query('SELECT declarant_id, statut FROM incident WHERE id = $1', [id]);
  if (!rows.length) throw new HttpError(404, 'INCIDENT_INTROUVABLE', 'Incident introuvable.');
  if (rows[0].declarant_id !== req.user.id) throw new HttpError(403, 'RG16', 'Vous ne pouvez modifier que vos propres incidents.');
  if (rows[0].statut !== 'SIGNALE') throw new HttpError(409, 'STATUT_INCOMPATIBLE', 'La pièce jointe ne peut être ajoutée que tant que l\'incident est signalé.');
  if (!req.file || !req.file.buffer.length) throw new HttpError(400, 'FICHIER_MANQUANT', 'Aucun fichier reçu (champ « photo »).');
  const type = detectType(req.file.buffer);
  if (!type) throw new HttpError(400, 'RG17', 'Pièce jointe refusée : seuls les fichiers JPEG et PNG sont acceptés.');

  await fs.promises.mkdir(config.uploadDir, { recursive: true });
  const stored = `${crypto.randomUUID()}.${type.ext}`;
  await fs.promises.writeFile(path.join(config.uploadDir, stored), req.file.buffer, { flag: 'wx' });
  try {
    const created = await query(
      `INSERT INTO piece_jointe (incident_id, nom_fichier, type_mime, taille_octets, chemin)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, nom_fichier, type_mime, taille_octets`,
      [id, safeName(req.file.originalname), type.mime, req.file.buffer.length, stored]
    );
    res.status(201).json(created.rows[0]);
  } catch (err) {
    await fs.promises.unlink(path.join(config.uploadDir, stored)).catch(() => {});
    if (err.code === '23505') throw new HttpError(409, 'PIECE_JOINTE_EXISTANTE', 'Cet incident a déjà une pièce jointe.');
    throw err;
  }
}));

// GET : télécharge la photo, avec les mêmes droits de lecture que l'incident.
router.get('/', asyncHandler(async (req, res) => {
  const id = v.paramId(req.params.id);
  const { rows } = await query(
    `SELECT p.type_mime, p.chemin, i.declarant_id
     FROM piece_jointe p JOIN incident i ON i.id = p.incident_id WHERE p.incident_id = $1`, [id]);
  if (!rows.length) throw new HttpError(404, 'PIECE_JOINTE_INTROUVABLE', 'Aucune pièce jointe pour cet incident.');
  if (!(await canView(req.user, id, rows[0].declarant_id))) throw new HttpError(403, 'RG16', 'Vous ne pouvez consulter que vos propres incidents.');
  const file = path.join(path.resolve(config.uploadDir), path.basename(rows[0].chemin));
  res.set('Content-Type', rows[0].type_mime);
  res.set('Cross-Origin-Resource-Policy', 'cross-origin');
  res.set('Cache-Control', 'private, max-age=0');
  res.sendFile(file, (err) => {
    if (err && !res.headersSent) res.status(404).json({ error: 'PIECE_JOINTE_INTROUVABLE', message: 'Fichier introuvable sur le serveur.' });
  });
}));

module.exports = router;
