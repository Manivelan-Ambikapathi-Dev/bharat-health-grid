import mysql from 'mysql2/promise';
import { db } from './env.js';

const pool = mysql.createPool({
  host: db.host,
  port: db.port,
  user: db.user,
  password: db.password,
  database: db.database,
  waitForConnections: true,
  connectionLimit: 10,
  namedPlaceholders: true,
  dateStrings: true,
});

async function query(sql, params) {
  const [rows] = params ? await pool.query(sql, params) : await pool.query(sql);
  return rows;
}

export { pool, query };
