import mysql from 'mysql2/promise';
import { db } from './env.js';

const connectionConfig = process.env.MYSQL_URL
  ? { uri: process.env.MYSQL_URL }
  : {
      host: db.host,
      port: db.port,
      user: db.user,
      password: db.password,
      database: db.database,
    };

const pool = mysql.createPool({
  ...connectionConfig,
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
