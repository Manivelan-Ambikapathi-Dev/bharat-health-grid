import { query } from '../config/db.js';
import { toNumber } from '../utils/http.js';
import { stockDaysSql, stockStatusSql } from './stockRules.js';
import { appendScope } from '../auth/scopeSql.js';

function mapStock(row) {
  return {
    phc_id: row.phc_id,
    phc: row.phc,
    district: row.district,
    state: row.state,
    medicine: row.medicine,
    generic_name: row.generic_name,
    batch_number: row.batch_number,
    current_quantity: toNumber(row.current_quantity),
    daily_average_usage: toNumber(row.daily_average_usage),
    expiry_date: row.expiry_date,
    reorder_level: toNumber(row.reorder_level),
    stock_days: toNumber(row.stock_days),
    stock_status: row.stock_status,
  };
}

async function listMedicineStock({ phcId, access } = {}) {
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
       m.name AS medicine,
       m.generic_name,
       ms.batch_number,
       ms.current_quantity,
       ms.daily_average_usage,
       ms.expiry_date,
       m.reorder_level,
       ${stockDaysSql} AS stock_days,
       ${stockStatusSql} AS stock_status
     FROM medicine_stock ms
     JOIN phcs p ON p.id = ms.phc_id
     JOIN districts d ON d.id = p.district_id
     JOIN states s ON s.id = d.state_id
     JOIN medicines m ON m.id = ms.medicine_id
     ${where}
     ORDER BY s.name, d.name, p.name, m.name, ms.batch_number`,
    params,
  );

  return rows.map(mapStock);
}

export { listMedicineStock };
