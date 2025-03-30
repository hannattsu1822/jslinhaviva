// db.js
const mysql = require('mysql2');

// Cria a conexão com o banco de dados MySQL
const connection = mysql.createConnection({
  host: '159.223.147.154',
  user: 'root',
  password: '289956Hg@#nhm', // Substitua pela sua senha real
  database: 'banco_linha',
  // Caso a porta seja diferente de 3306, descomente e ajuste a linha abaixo:
  // port: 3306,
});

// Conecta ao banco de dados
connection.connect(err => {
  if (err) {
    console.error('Erro ao conectar ao banco:', err);
    return;
  }
  console.log('Conectado ao banco de dados MySQL!');
});

// Exemplo de query utilizando callback:
connection.query('SELECT * FROM sua_tabela', (err, results) => {
  if (err) {
    console.error('Erro na query (callback):', err);
    return;
  }
  console.log('Resultados da query (callback):', results);
});

// Exemplo de query utilizando async/await com a interface de promessas:
const promiseConnection = connection.promise();

async function fetchData() {
  try {
    const [rows] = await promiseConnection.query('SELECT * FROM sua_tabela');
    console.log('Resultados da query (async/await):', rows);
  } catch (err) {
    console.error('Erro na query (async/await):', err);
  }
}

fetchData();

module.exports = connection;
