const { Pool } = require('pg');

const pool = new Pool({
  user: 'root',
  host: '127.0.0.1',
  database: 'banco_linha',
  password: '289956Hg@#nhm',
  port: 33006,
});

module.exports = pool;
