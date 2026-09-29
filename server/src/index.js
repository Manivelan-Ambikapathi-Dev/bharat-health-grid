import app from './app.js';
import { port } from './config/env.js';
import { pool } from './config/db.js';
import { ensureDatabaseInitialized } from './config/initDb.js';

try {
  await pool.query('SELECT 1');
  console.log('Connected to the bharat_health_grid database');
} catch (error) {
  console.error('Database connection failed.', {
    message: error.message,
    code: error.code,
    errno: error.errno,
    sqlState: error.sqlState,
  });
  process.exit(1);
}

try {
  await ensureDatabaseInitialized();
} catch (error) {
  console.error('Database initialization failed.', {
    message: error.message,
    code: error.code,
    errno: error.errno,
    sqlState: error.sqlState,
  });
  process.exit(1);
}

app.listen(port, () => {
  console.log(`Bharat Health Grid API listening on port ${port}`);
});
