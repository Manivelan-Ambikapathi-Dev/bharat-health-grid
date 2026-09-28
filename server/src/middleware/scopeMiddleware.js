import { query } from '../config/db.js';
import { ROLES } from '../constants/roles.js';
import { createHttpError, textQuery } from '../utils/http.js';
import { FORBIDDEN_MESSAGE } from './rbacMiddleware.js';

function forbidden() {
  return createHttpError(403, FORBIDDEN_MESSAGE);
}

function assertPlace(user, place) {
  if (!user || user.role === ROLES.NATIONAL_ADMIN) {
    return;
  }
  if (place.state_id != null && user.stateId && Number(place.state_id) !== Number(user.stateId)) {
    throw forbidden();
  }
  if (place.district_id != null
    && (user.role === ROLES.DISTRICT_OFFICER || user.role === ROLES.PHC_STAFF)
    && Number(place.district_id) !== Number(user.districtId)) {
    throw forbidden();
  }
  if (place.id != null && user.role === ROLES.PHC_STAFF && Number(place.id) !== Number(user.phcId)) {
    throw forbidden();
  }
}

async function findState(value) {
  const text = String(value).trim();
  if (/^\d+$/.test(text)) {
    const rows = await query('SELECT id, name FROM states WHERE id = :id', { id: Number(text) });
    return rows[0] || null;
  }
  const rows = await query(
    `SELECT id, name
     FROM states
     WHERE LOWER(name) = LOWER(:name) OR UPPER(code) = UPPER(:name)`,
    { name: text },
  );
  return rows[0] || null;
}

async function findDistrict(value) {
  const text = String(value).trim();
  if (/^\d+$/.test(text)) {
    const rows = await query(
      `SELECT d.id, d.name, d.state_id, s.name AS state_name
       FROM districts d
       JOIN states s ON s.id = d.state_id
       WHERE d.id = :id`,
      { id: Number(text) },
    );
    return rows[0] || null;
  }
  const rows = await query(
    `SELECT d.id, d.name, d.state_id, s.name AS state_name
     FROM districts d
     JOIN states s ON s.id = d.state_id
     WHERE LOWER(d.name) = LOWER(:name)`,
    { name: text },
  );
  return rows[0] || null;
}

async function findPhc(phcId) {
  const rows = await query(
    `SELECT p.id, p.name, d.id AS district_id, d.name AS district_name, s.id AS state_id, s.name AS state_name
     FROM phcs p
     JOIN districts d ON d.id = p.district_id
     JOIN states s ON s.id = d.state_id
     WHERE p.id = :id`,
    { id: phcId },
  );
  return rows[0] || null;
}

async function findPhcByName(name) {
  const text = String(name || '').trim();
  if (!text) {
    return null;
  }
  const rows = await query(
    `SELECT p.id, p.name, d.id AS district_id, d.name AS district_name, s.id AS state_id, s.name AS state_name
     FROM phcs p
     JOIN districts d ON d.id = p.district_id
     JOIN states s ON s.id = d.state_id
     WHERE p.name = :name
        OR p.name = CONCAT('Government PHC, ', :name)
        OR LOWER(p.name) = LOWER(:name)`,
    { name: text },
  );
  return rows[0] || null;
}

async function requireStateScope(req, _res, next) {
  try {
    const requested = textQuery(req.query.state) || textQuery(req.query.state_id);
    if (!requested || !req.user || req.user.role === ROLES.NATIONAL_ADMIN) {
      next();
      return;
    }
    const state = await findState(requested);
    if (!state) {
      next(createHttpError(404, 'State not found'));
      return;
    }
    assertPlace(req.user, { state_id: state.id });
    next();
  } catch (error) {
    next(error);
  }
}

async function requireDistrictScope(req, _res, next) {
  try {
    const requested = textQuery(req.query.district) || textQuery(req.query.district_id);
    if (!requested || !req.user || req.user.role === ROLES.NATIONAL_ADMIN) {
      next();
      return;
    }
    const district = await findDistrict(requested);
    if (!district) {
      next(createHttpError(404, 'District not found'));
      return;
    }
    assertPlace(req.user, { state_id: district.state_id, district_id: district.id });
    next();
  } catch (error) {
    next(error);
  }
}

async function requirePhcScope(req, _res, next) {
  try {
    const raw = textQuery(req.params.phcId) || textQuery(req.query.phc_id);
    if (!raw || !req.user || req.user.role === ROLES.NATIONAL_ADMIN) {
      next();
      return;
    }
    if (!/^\d+$/.test(raw)) {
      next(createHttpError(400, 'phc_id must be a positive integer'));
      return;
    }
    const phc = await findPhc(Number(raw));
    if (!phc) {
      next(createHttpError(404, 'PHC not found'));
      return;
    }
    assertPlace(req.user, phc);
    next();
  } catch (error) {
    next(error);
  }
}

async function enforceRequestScope(req, res, next) {
  requireStateScope(req, res, (stateError) => {
    if (stateError) {
      next(stateError);
      return;
    }
    requireDistrictScope(req, res, (districtError) => {
      if (districtError) {
        next(districtError);
        return;
      }
      requirePhcScope(req, res, next);
    });
  });
}

export {
  assertPlace,
  findPhc,
  findPhcByName,
  requireStateScope,
  requireDistrictScope,
  requirePhcScope,
  enforceRequestScope,
};
