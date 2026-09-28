import dotenv from 'dotenv';

dotenv.config();

function requiredEnv(name) {
  const value = process.env[name];
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const port = Number(process.env.PORT) || 5000;
const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

const dbPort = Number(requiredEnv('DB_PORT'));
if (!Number.isInteger(dbPort) || dbPort <= 0) {
  throw new Error('DB_PORT must be a positive integer');
}

const db = {
  host: requiredEnv('DB_HOST'),
  port: dbPort,
  user: requiredEnv('DB_USER'),
  password: requiredEnv('DB_PASSWORD'),
  database: requiredEnv('DB_NAME'),
};

const jwtSecret = requiredEnv('JWT_SECRET');
if (jwtSecret.length < 16) {
  throw new Error('JWT_SECRET must be at least 16 characters');
}

export { port, clientOrigin, db, jwtSecret };
