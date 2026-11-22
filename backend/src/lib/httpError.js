// Erreur métier avec son code HTTP ; le gestionnaire d'erreurs la renvoie telle quelle au client.
class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
module.exports = { HttpError };
