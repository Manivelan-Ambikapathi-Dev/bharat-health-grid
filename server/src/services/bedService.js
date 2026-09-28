import { query } from '../config/db.js';
import { toNumber } from '../utils/http.js';
import { appendScope } from '../auth/scopeSql.js';

function mapBed(row) {
  return {
    phc_id: row.phc_id,
    phc: row.phc,
    district: row.district,
    state: row.state,
    total_beds: toNumber(row.total_beds),
    occupied_beds: toNumber(row.occupied_beds),
    available_beds: toNumber(row.available_beds),
    occupancy_percentage: toNumber(row.occupancy_percentage),
    last_updated: row.last_updated,
  };
}

async function listBeds({ phcId, access } = {}) {
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
       b.total_beds,
       b.occupied_beds,
       b.available_beds,
       CASE
         WHEN b.total_beds = 0 THEN 0
         ELSE ROUND(100 * b.occupied_beds / b.total_beds, 1)
       END AS occupancy_percentage,
       b.last_updated
     FROM beds b
     JOIN phcs p ON p.id = b.phc_id
     JOIN districts d ON d.id = p.district_id
     JOIN states s ON s.id = d.state_id
     ${where}
     ORDER BY s.name, d.name, p.name`,
    params,
  );

  return rows.map(mapBed);
}

export { listBeds };
