import { query } from '../config/db.js';
import { toNumber } from '../utils/http.js';
import { stockStatusSql } from './stockRules.js';
import { getPhcById } from './phcService.js';
import { listMedicineStock } from './medicineStockService.js';
import { listBeds } from './bedService.js';
import { listPersonnel } from './personnelService.js';
import { listAttendance } from './attendanceService.js';
import { listFootfall } from './footfallService.js';

function mapStateSummary(row) {
  return {
    state: row.state,
    total_phcs: toNumber(row.total_phcs),
    total_patients: toNumber(row.total_patients),
    total_medicine_stock: toNumber(row.total_medicine_stock),
    low_stock_count: toNumber(row.low_stock_count),
    critical_stock_count: toNumber(row.critical_stock_count),
    total_beds: toNumber(row.total_beds),
    occupied_beds: toNumber(row.occupied_beds),
    available_beds: toNumber(row.available_beds),
    occupancy_percentage: toNumber(row.occupancy_percentage),
    personnel_present: toNumber(row.personnel_present),
    personnel_absent: toNumber(row.personnel_absent),
    personnel_on_leave: toNumber(row.personnel_on_leave),
    attendance_date: row.attendance_date,
  };
}

async function getStateSummary() {
  const rows = await query(
    `SELECT
       s.name AS state,
       COALESCE(phc_counts.total_phcs, 0) AS total_phcs,
       COALESCE(patients.total_patients, 0) AS total_patients,
       COALESCE(stock.total_medicine_stock, 0) AS total_medicine_stock,
       COALESCE(stock.low_stock_count, 0) AS low_stock_count,
       COALESCE(stock.critical_stock_count, 0) AS critical_stock_count,
       COALESCE(bed_totals.total_beds, 0) AS total_beds,
       COALESCE(bed_totals.occupied_beds, 0) AS occupied_beds,
       COALESCE(bed_totals.available_beds, 0) AS available_beds,
       CASE
         WHEN COALESCE(bed_totals.total_beds, 0) = 0 THEN 0
         ELSE ROUND(100 * bed_totals.occupied_beds / bed_totals.total_beds, 1)
       END AS occupancy_percentage,
       COALESCE(attendance.personnel_present, 0) AS personnel_present,
       COALESCE(attendance.personnel_absent, 0) AS personnel_absent,
       COALESCE(attendance.personnel_on_leave, 0) AS personnel_on_leave,
       attendance.attendance_date AS attendance_date
     FROM states s
     LEFT JOIN (
       SELECT d.state_id, COUNT(*) AS total_phcs
       FROM phcs p
       JOIN districts d ON d.id = p.district_id
       GROUP BY d.state_id
     ) phc_counts ON phc_counts.state_id = s.id
     LEFT JOIN (
       SELECT d.state_id, SUM(f.total_patients) AS total_patients
       FROM patient_footfall f
       JOIN phcs p ON p.id = f.phc_id
       JOIN districts d ON d.id = p.district_id
       GROUP BY d.state_id
     ) patients ON patients.state_id = s.id
     LEFT JOIN (
       SELECT
         d.state_id,
         SUM(ms.current_quantity) AS total_medicine_stock,
         SUM(CASE WHEN ${stockStatusSql} = 'LOW' THEN 1 ELSE 0 END) AS low_stock_count,
         SUM(CASE WHEN ${stockStatusSql} = 'CRITICAL' THEN 1 ELSE 0 END) AS critical_stock_count
       FROM medicine_stock ms
       JOIN phcs p ON p.id = ms.phc_id
       JOIN districts d ON d.id = p.district_id
       GROUP BY d.state_id
     ) stock ON stock.state_id = s.id
     LEFT JOIN (
       SELECT
         d.state_id,
         SUM(b.total_beds) AS total_beds,
         SUM(b.occupied_beds) AS occupied_beds,
         SUM(b.available_beds) AS available_beds
       FROM beds b
       JOIN phcs p ON p.id = b.phc_id
       JOIN districts d ON d.id = p.district_id
       GROUP BY d.state_id
     ) bed_totals ON bed_totals.state_id = s.id
     LEFT JOIN (
       SELECT
         d.state_id,
         SUM(a.status = 'Present') AS personnel_present,
         SUM(a.status = 'Absent') AS personnel_absent,
         SUM(a.status = 'Leave') AS personnel_on_leave,
         MAX(a.attendance_date) AS attendance_date
       FROM personnel_attendance a
       JOIN phcs p ON p.id = a.phc_id
       JOIN districts d ON d.id = p.district_id
       WHERE a.attendance_date = (
         SELECT MAX(attendance_date)
         FROM personnel_attendance
         WHERE attendance_date <= CURDATE()
       )
       GROUP BY d.state_id
     ) attendance ON attendance.state_id = s.id
     ORDER BY s.name`,
  );

  return rows.map(mapStateSummary);
}

function countBy(items, field) {
  return items.reduce((counts, item) => {
    const key = item[field];
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

async function getPhcSummary(phcId) {
  const phc = await getPhcById(phcId);
  if (!phc) {
    return null;
  }

  const [stock, beds, personnel, attendance, footfall] = await Promise.all([
    listMedicineStock({ phcId }),
    listBeds({ phcId }),
    listPersonnel({ phcId }),
    listAttendance({ phcId }),
    listFootfall({ phcId, limit: 7 }),
  ]);

  const latestDate = attendance.reduce((latest, row) => {
    if (!latest || row.date > latest) {
      return row.date;
    }
    return latest;
  }, null);
  const latestAttendance = latestDate
    ? attendance.filter((row) => row.date === latestDate)
    : [];
  const bed = beds[0] || null;

  return {
    phc,
    medicine_stock: {
      total_batches: stock.length,
      healthy: stock.filter((row) => row.stock_status === 'HEALTHY').length,
      low: stock.filter((row) => row.stock_status === 'LOW').length,
      critical: stock.filter((row) => row.stock_status === 'CRITICAL').length,
      out_of_stock: stock.filter((row) => row.stock_status === 'OUT_OF_STOCK').length,
      excess: stock.filter((row) => row.stock_status === 'EXCESS').length,
      items: stock,
    },
    beds: bed,
    personnel: {
      total: personnel.length,
      by_role: countBy(personnel, 'role'),
      by_employment_status: countBy(personnel, 'employment_status'),
      members: personnel,
    },
    attendance: {
      date: latestDate,
      present: latestAttendance.filter((row) => row.status === 'Present').length,
      absent: latestAttendance.filter((row) => row.status === 'Absent').length,
      on_leave: latestAttendance.filter((row) => row.status === 'Leave').length,
      records: latestAttendance,
    },
    recent_footfall: [...footfall].reverse(),
  };
}

export { getStateSummary, getPhcSummary };
