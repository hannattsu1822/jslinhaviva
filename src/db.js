const { Pool } = require('pg');

const pool = new Pool({
  user: 'root',
  host: '159.223.147.154',
  database: 'banco_linha',
  password: '289956Hg@#nhm',
  port: 33006,
});

module.exports = pool;
