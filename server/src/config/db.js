import mysql from 'mysql2/promise';
import { db } from './env.js';

const usingMysqlUrl = Boolean(process.env.MYSQL_URL);

if (usingMysqlUrl) {
  let host = 'unavailable';
  let port = 'unavailable';
  try {
    const parsed = new URL(process.env.MYSQL_URL);
    host = parsed.hostname;
    port = parsed.port || '3306';
  } catch {
    // Do not log MYSQL_URL or the parse error; it can contain credentials.
  }
  console.log('DB connection mode: MYSQL_URL');
  console.log('DB host:', host);
  console.log('DB port:', port);
} else {
  console.log('DB connection mode: individual DB variables');
  console.log('DB host:', db.host);
  console.log('DB port:', db.port);
}

const connectionConfig = usingMysqlUrl
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
