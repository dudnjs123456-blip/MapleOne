// userdb.js
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '비밀번호',
  database: 'user_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

async function query(sql, params) {
  console.log('실행할 SQL:', sql);
  console.log('바인딩 값:', params);
  const [rows] = await pool.query(sql, params);
  return rows;
}

module.exports = {
  query,
  pool,
};