const app = require('./app');
const config = require('./config');

app.listen(config.port, () => console.log(`API HelpDesk démarrée sur le port ${config.port} (${config.env})`));
