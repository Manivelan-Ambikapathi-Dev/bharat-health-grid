import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query } from '../config/db.js';
import { jwtSecret } from '../config/env.js';
import { ROLES } from '../constants/roles.js';
import { createHttpError } from '../utils/http.js';

const USER_SQL = `
  SELECT
    u.id,
    u.username,
    u.password_hash,
    u.name,
    u.role,
    u.state_id,
    u.district_id,
    u.phc_id,
    u.is_active,
    s.name AS state_name,
    d.name AS district_name,
    p.name AS phc_name
  FROM users u
  LEFT JOIN states s ON s.id = u.state_id
  LEFT JOIN districts d ON d.id = u.district_id
  LEFT JOIN phcs p ON p.id = u.phc_id
`;

function scopeLabel(row) {
  if (row.role === ROLES.STATE_ADMIN) {
    return row.state_name;
  }
  if (row.role === ROLES.DISTRICT_OFFICER) {
    return row.district_name;
  }
  if (row.role === ROLES.PHC_STAFF) {
    const shortName = String(row.phc_name || '').replace(/^Government PHC,\s*/i, '');
    return `${shortName} PHC`;
  }
  return 'India';
}

function toPublicUser(row) {
  return {
    id: row.id,
    username: row.username,
    name: row.name,
    role: row.role,
    state_id: row.state_id,
    district_id: row.district_id,
    phc_id: row.phc_id,
    stateId: row.state_id,
    districtId: row.district_id,
    phcId: row.phc_id,
    stateName: row.state_name,
    districtName: row.district_name,
    phcName: row.phc_name,
    state_name: row.state_name,
    district_name: row.district_name,
    phc_name: row.phc_name,
    scope_label: scopeLabel(row),
  };
}

async function findUserByUsername(username) {
  const rows = await query(`${USER_SQL} WHERE u.username = :username`, { username });
  return rows[0] || null;
}

async function findUserById(id) {
  const rows = await query(`${USER_SQL} WHERE u.id = :id`, { id });
  return rows[0] || null;
}

function signToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      username: user.username,
      role: user.role,
      stateId: user.state_id,
      districtId: user.district_id,
      phcId: user.phc_id,
    },
    jwtSecret,
    { expiresIn: '12h' },
  );
}

async function login(username, password) {
  const row = await findUserByUsername(username);
  if (!row || !row.is_active) {
    throw createHttpError(401, 'Invalid username or password');
  }
  const matches = await bcrypt.compare(password, row.password_hash);
  if (!matches) {
    throw createHttpError(401, 'Invalid username or password');
  }
  const user = toPublicUser(row);
  return { token: signToken(row), user };
}

async function currentUser(userId) {
  const row = await findUserById(userId);
  if (!row || !row.is_active) {
    return null;
  }
  return toPublicUser(row);
}

export { login, currentUser, toPublicUser };
