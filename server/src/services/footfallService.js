import { query } from '../config/db.js';
import { toNumber } from '../utils/http.js';
import { appendScope } from '../auth/scopeSql.js';

function mapFootfall(row) {
  return {
    phc_id: row.phc_id,
    phc: row.phc,
    district: row.district,
    state: row.state,
    date: row.record_date,
    total_patients: toNumber(row.total_patients),
    emergency_patients: toNumber(row.emergency_patients),
    outpatient_patients: toNumber(row.outpatient_patients),
  };
}

async function listFootfall({ phcId, from, to, limit, access } = {}) {
  const conditions = [];
  const params = {};

  if (phcId) {
    conditions.push('p.id = :phcId');
    params.phcId = phcId;
  }
  if (from) {
    conditions.push('f.record_date >= :fromDate');
    params.fromDate = from;
  }
  if (to) {
    conditions.push('f.record_date <= :toDate');
    params.toDate = to;
  }
  appendScope(conditions, params, access);

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const safeLimit = Number.isInteger(limit) && limit > 0 ? limit : null;
  const limitSql = safeLimit ? `LIMIT ${safeLimit}` : '';

  const rows = await query(
    `SELECT
       p.id AS phc_id,
       p.name AS phc,
       d.name AS district,
       s.name AS state,
       f.record_date,
       f.total_patients,
       f.emergency_patients,
       f.outpatient_patients
     FROM patient_footfall f
     JOIN phcs p ON p.id = f.phc_id
     JOIN districts d ON d.id = p.district_id
     JOIN states s ON s.id = d.state_id
     ${where}
     ORDER BY f.record_date DESC, s.name, d.name, p.name
     ${limitSql}`,
    params,
  );

  return rows.map(mapFootfall);
}

export { listFootfall };
