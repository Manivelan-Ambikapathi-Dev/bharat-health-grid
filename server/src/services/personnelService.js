import { query } from '../config/db.js';
import { appendScope } from '../auth/scopeSql.js';

function mapPersonnel(row) {
  return {
    phc_id: row.phc_id,
    phc: row.phc,
    district: row.district,
    state: row.state,
    name: row.name,
    role: row.role,
    specialization: row.specialization,
    employment_status: row.employment_status,
  };
}

async function listPersonnel({ phcId, access } = {}) {
  const conditions = [];
  const params = {};
  if (phcId) {
    conditions.push('p.id = :phcId');
    params.phcId = phcId;
  }
  appendScope(conditions, params, access);
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const rows = await query(
    `SELECT
       p.id AS phc_id,
       p.name AS phc,
       d.name AS district,
       s.name AS state,
       pe.name,
       pe.role,
       pe.specialization,
       pe.employment_status
     FROM personnel pe
     JOIN phcs p ON p.id = pe.phc_id
     JOIN districts d ON d.id = p.district_id
     JOIN states s ON s.id = d.state_id
     ${where}
     ORDER BY s.name, d.name, p.name, pe.role, pe.name`,
    params,
  );

  return rows.map(mapPersonnel);
}

export { listPersonnel };
