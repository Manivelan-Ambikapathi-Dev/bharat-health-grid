import { clientOrigin } from '../config/env.js';

const allowedOrigins = [
  'http://localhost:5173',
  'https://bharat-health-grid.vercel.app',
];

if (!allowedOrigins.includes(clientOrigin)) {
  allowedOrigins.push(clientOrigin);
}

function corsMiddleware(req, res, next) {
  const origin = req.headers.origin;

  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }

  next();
}

export { corsMiddleware };
