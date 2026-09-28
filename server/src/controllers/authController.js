import { login } from '../services/authService.js';
import { createHttpError } from '../utils/http.js';

async function postLogin(req, res) {
  const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!username || !password) {
    throw createHttpError(400, 'username and password are required');
  }

  const data = await login(username, password);
  res.json({ success: true, data });
}

function getMe(req, res) {
  res.json({ success: true, data: req.user });
}

export { postLogin, getMe };
