const { Pool } = require('pg');

const pool = new Pool({
  user: 'root',
  host: 'localhost',
  database: 'banco_linha',
  password: '289956Hg@#',
  port: 33006,
});

module.exports = pool;