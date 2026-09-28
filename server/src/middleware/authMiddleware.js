import jwt from 'jsonwebtoken';
import { jwtSecret } from '../config/env.js';
import { currentUser } from '../services/authService.js';
import { createHttpError } from '../utils/http.js';

const AUTH_MESSAGE = 'Authentication required';

async function authenticate(req, _res, next) {
  const header = req.get('authorization') || '';
  const match = header.match(/^Bearer\s+(\S+)$/i);
  if (!match) {
    next(createHttpError(401, AUTH_MESSAGE));
    return;
  }

  let payload;
  try {
    payload = jwt.verify(match[1], jwtSecret);
  } catch {
    next(createHttpError(401, AUTH_MESSAGE));
    return;
  }

  if (!payload || payload.userId === undefined || payload.userId === null) {
    next(createHttpError(401, AUTH_MESSAGE));
    return;
  }

  const user = await currentUser(payload.userId);
  if (!user) {
    next(createHttpError(401, AUTH_MESSAGE));
    return;
  }

  req.user = user;
  next();
}

export { authenticate, AUTH_MESSAGE };
