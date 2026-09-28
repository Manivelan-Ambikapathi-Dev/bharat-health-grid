import { query } from '../config/db.js';
import { toNumber } from '../utils/http.js';
import { appendScope } from '../auth/scopeSql.js';

function mapPhc(row) {
  return {
    id: row.id,
    phc_code: row.phc_code,
    name: row.name,
    district: row.district,
    state: row.state,
    population_covered: toNumber(row.population_covered),
    status: row.status,
    latitude: toNumber(row.latitude),
    longitude: toNumber(row.longitude),
  };
}

async function listPhcs({ state, district, access } = {}) {
  const conditions = [];
  const params = {};

  if (state) {
    conditions.push('s.name = :state');
    params.state = state;
  }
  if (district) {
    conditions.push('d.name = :district');
    params.district = district;
  }
  appendScope(conditions, params, access);

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = await query(
    `SELECT
       p.id,
       p.phc_code,
       p.name,
       d.name AS district,
       s.name AS state,
       p.population_covered,
       p.status,
       p.latitude,
       p.longitude
     FROM phcs p
     JOIN districts d ON d.id = p.district_id
     JOIN states s ON s.id = d.state_id
     ${where}
     ORDER BY s.name, d.name, p.name`,
    params,
  );

  return rows.map(mapPhc);
}

async function getPhcById(phcId) {
  const rows = await query(
    `SELECT
       p.id,
       p.phc_code,
       p.name,
       d.name AS district,
       s.name AS state,
       p.population_covered,
       p.status,
       p.latitude,
       p.longitude
     FROM phcs p
     JOIN districts d ON d.id = p.district_id
     JOIN states s ON s.id = d.state_id
     WHERE p.id = :phcId`,
    { phcId },
  );

  return rows[0] ? mapPhc(rows[0]) : null;
}

export { listPhcs, getPhcById };
