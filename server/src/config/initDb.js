import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './db.js';

const REQUIRED_TABLES = [
  'states',
  'districts',
  'phcs',
  'medicines',
  'medicine_stock',
  'beds',
  'personnel',
  'personnel_attendance',
  'patient_footfall',
  'users',
];

const INIT_LOCK = 'bhg_db_init';

function resolveDatabaseDir() {
  const databaseDir = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../database',
  );
  const missing = ['schema.sql', 'seed_users.sql'].filter(
    (fileName) => !fs.existsSync(path.join(databaseDir, fileName)),
  );

  if (missing.length > 0) {
    throw new Error(
      `Missing ${missing.join(' and ')} in server/database. Run npm run build so the server can copy them from database/.`,
    );
  }

  return databaseDir;
}

let databaseDir;

function getDatabaseDir() {
  if (!databaseDir) {
    databaseDir = resolveDatabaseDir();
  }
  return databaseDir;
}

function stripComments(sql) {
  return sql
    .split(/\r?\n/)
    .filter((line) => !line.trimStart().startsWith('--'))
    .join('\n');
}

function splitStatements(sql) {
  const statements = [];
  let current = '';
  let inString = false;
  let quote = '';

  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index];

    if (inString) {
      current += char;
      if (char === quote) {
        if (sql[index + 1] === quote) {
          current += sql[index + 1];
          index += 1;
          continue;
        }
        inString = false;
      }
      continue;
    }

    if (char === '\'' || char === '"') {
      inString = true;
      quote = char;
      current += char;
      continue;
    }

    if (char === ';') {
      const statement = current.trim();
      if (statement) {
        statements.push(statement);
      }
      current = '';
      continue;
    }

    current += char;
  }

  const tail = current.trim();
  if (tail) {
    statements.push(tail);
  }

  return statements;
}

function isDatabaseAdminStatement(statement) {
  const lead = statement.replace(/\s+/g, ' ').trim().toUpperCase();
  return (
    lead.startsWith('DROP DATABASE')
    || lead.startsWith('CREATE DATABASE')
    || lead.startsWith('USE ')
  );
}

function adaptStatement(statement, options) {
  let sql = statement;

  if (options.createIfNotExists) {
    sql = sql.replace(/^CREATE TABLE\s+(?!IF\s+NOT\s+EXISTS)/i, 'CREATE TABLE IF NOT EXISTS ');
  }

  if (options.insertIgnore) {
    sql = sql.replace(/^INSERT INTO\s+/i, 'INSERT IGNORE INTO ');
  }

  return sql;
}

function prepareInitStatements(sql, options = {}) {
  return splitStatements(stripComments(sql))
    .filter((statement) => !isDatabaseAdminStatement(statement))
    .map((statement) => adaptStatement(statement, options));
}

async function applySqlFile(connection, filename, options = {}) {
  const filePath = path.join(getDatabaseDir(), filename);
  const sql = await fs.promises.readFile(filePath, 'utf8');
  const statements = prepareInitStatements(sql, options);

  for (const statement of statements) {
    try {
      await connection.query({ sql: statement, namedPlaceholders: false });
    } catch (error) {
      const preview = statement.split('\n')[0].slice(0, 160);
      const failure = new Error(
        `Failed while applying ${filename} (${preview}): ${error.message}`,
      );
      failure.code = error.code;
      failure.errno = error.errno;
      failure.sqlState = error.sqlState;
      throw failure;
    }
  }

  return statements.length;
}

async function selectRows(connection, sql, params) {
  const [rows] = await connection.query(
    { sql, namedPlaceholders: false },
    params,
  );
  return rows;
}

async function existingRequiredTables(connection) {
  const placeholders = REQUIRED_TABLES.map(() => '?').join(', ');
  const rows = await selectRows(
    connection,
    `SELECT TABLE_NAME AS tableName
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME IN (${placeholders})`,
    REQUIRED_TABLES,
  );

  return new Set(rows.map((row) => String(row.tableName).toLowerCase()));
}

async function demoUserCount(connection) {
  const rows = await selectRows(connection, 'SELECT COUNT(*) AS count FROM users');
  return Number(rows[0].count);
}

async function initializeOnConnection(connection) {
  const existing = await existingRequiredTables(connection);
  const missing = REQUIRED_TABLES.filter((table) => !existing.has(table));
  const users = existing.has('users') ? await demoUserCount(connection) : 0;

  if (missing.length === 0 && users > 0) {
    console.log('Database tables already exist. Skipping initialization.');
    return;
  }

  if (users > 0) {
    console.log(
      `Database already contains users. Skipping initialization so existing data is left unchanged. Missing tables: ${missing.join(', ')}.`,
    );
    return;
  }

  if (missing.length === 0) {
    console.log('Users table is empty. Loading demo logins from seed_users.sql.');
    await applySqlFile(connection, 'seed_users.sql');
    console.log('Demo login users created.');
    return;
  }

  const empty = existing.size === 0;
  if (empty) {
    console.log('Database is empty. Loading schema.sql and seed_users.sql.');
  } else {
    console.log(
      'Database is only partly initialized. Loading the missing schema and seed data without deleting or updating existing rows.',
    );
  }

  const schemaCount = await applySqlFile(connection, 'schema.sql', {
    createIfNotExists: !empty,
    insertIgnore: !empty,
  });
  const seedCount = await applySqlFile(connection, 'seed_users.sql');
  console.log(
    `Database initialization finished (${schemaCount} schema statements, ${seedCount} seed statements).`,
  );
}

export async function ensureDatabaseInitialized() {
  const connection = await pool.getConnection();

  try {
    const lockRows = await selectRows(
      connection,
      'SELECT GET_LOCK(?, 180) AS got',
      [INIT_LOCK],
    );

    if (Number(lockRows[0].got) !== 1) {
      throw new Error('Timed out waiting for the database initialization lock.');
    }

    try {
      await initializeOnConnection(connection);
    } finally {
      await selectRows(connection, 'SELECT RELEASE_LOCK(?)', [INIT_LOCK]);
    }
  } finally {
    connection.release();
  }
}
