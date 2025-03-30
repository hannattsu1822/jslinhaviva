const mysql = require('mysql2');

const connection = mysql.createConnection({
  host: '159.223.147.154',
  user: 'root',
  password: '289956Hg@#nhm', // Substitua pela sua senha
  database: 'banco_linha',
});

connection.connect(err => {
  if (err) {
    console.error('Erro ao conectar ao banco:', err);
    return;
  }
  console.log('Conectado ao banco de dados MySQL!');
});

module.exports = connection;
