const { app } = require('./init');
const router = require('./routes');
require('dotenv').config();

// Usar as rotas
app.use('/', router);

// Iniciar o servidor
const port = process.env.SERVER_PORT || 3000;
app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});