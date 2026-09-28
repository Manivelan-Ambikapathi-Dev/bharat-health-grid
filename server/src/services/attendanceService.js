import { query } from '../config/db.js';
import { appendScope } from '../auth/scopeSql.js';

function mapAttendance(row) {
  return {
    phc_id: row.phc_id,
    phc: row.phc,
    district: row.district,
    state: row.state,
    personnel: row.personnel,
    role: row.role,
    date: row.attendance_date,
    status: row.status,
    check_in: row.check_in,
    check_out: row.check_out,
  };
}

async function listAttendance({ date, state, phcId, access } = {}) {
  const conditions = [];
  const params = {};

  if (date) {
    conditions.push('a.attendance_date = :attendanceDate');
    params.attendanceDate = date;
  }
  if (state) {
    conditions.push('s.name = :state');
    params.state = state;
  }
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
       pe.name AS personnel,
       pe.role,
       a.attendance_date,
       a.status,
       a.check_in,
       a.check_out
     FROM personnel_attendance a
     JOIN personnel pe ON pe.id = a.personnel_id
     JOIN phcs p ON p.id = a.phc_id
     JOIN districts d ON d.id = p.district_id
     JOIN states s ON s.id = d.state_id
     ${where}
     ORDER BY a.attendance_date, s.name, d.name, p.name, pe.name`,
    params,
  );

  return rows.map(mapAttendance);
}

export { listAttendance };
