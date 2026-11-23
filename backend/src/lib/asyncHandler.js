// Express 4 n'attrape pas les erreurs des fonctions async : ce wrapper les transmet au gestionnaire d'erreurs.
module.exports = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
