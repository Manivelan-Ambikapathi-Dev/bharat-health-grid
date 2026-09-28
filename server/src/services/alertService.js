import { query } from '../config/db.js';
import { toNumber } from '../utils/http.js';
import { stockDaysSql, stockStatusSql } from './stockRules.js';

const severityRank = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

function shiftDate(isoDate, days) {
  const [year, month, day] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatDays(value) {
  const number = toNumber(value);
  if (number === null) {
    return null;
  }
  return Number.isInteger(number) ? String(number) : number.toFixed(1);
}

function location(row) {
  return {
    phc: row.phc,
    district: row.district,
    state: row.state,
  };
}

async function medicineAlerts() {
  const rows = await query(
    `SELECT
       p.name AS phc,
       d.name AS district,
       s.name AS state,
       m.name AS medicine,
       m.unit,
       ms.batch_number,
       ms.current_quantity,
       ms.daily_average_usage,
       ${stockDaysSql} AS stock_days,
       ${stockStatusSql} AS stock_status
     FROM medicine_stock ms
     JOIN phcs p ON p.id = ms.phc_id
     JOIN districts d ON d.id = p.district_id
     JOIN states s ON s.id = d.state_id
     JOIN medicines m ON m.id = ms.medicine_id
     HAVING stock_status IN ('CRITICAL', 'LOW')`,
  );

  return rows.map((row) => {
    const stockDays = formatDays(row.stock_days);
    const quantity = toNumber(row.current_quantity);
    const usage = formatDays(row.daily_average_usage);
    if (row.stock_status === 'CRITICAL') {
      return {
        type: 'MEDICINE_STOCK_OUT',
        severity: 'CRITICAL',
        title: `${row.medicine} stock-out risk at ${row.phc}`,
        message: `Batch ${row.batch_number} has ${quantity} ${row.unit.toLowerCase()}s left, about ${stockDays} days at ${usage} per day.`,
        ...location(row),
      };
    }
    return {
      type: 'LOW_STOCK',
      severity: 'MEDIUM',
      title: `${row.medicine} is low at ${row.phc}`,
      message: `Batch ${row.batch_number} has about ${stockDays} days of stock remaining (${quantity} ${row.unit.toLowerCase()}s, ${usage} used per day).`,
      ...location(row),
    };
  });
}

async function expiryAlerts() {
  const rows = await query(
    `SELECT
       p.name AS phc,
       d.name AS district,
       s.name AS state,
       m.name AS medicine,
       ms.batch_number,
       ms.current_quantity,
       ms.expiry_date,
       DATEDIFF(ms.expiry_date, CURDATE()) AS days_to_expiry
     FROM medicine_stock ms
     JOIN phcs p ON p.id = ms.phc_id
     JOIN districts d ON d.id = p.district_id
     JOIN states s ON s.id = d.state_id
     JOIN medicines m ON m.id = ms.medicine_id
     WHERE ms.current_quantity > 0
       AND ms.expiry_date >= CURDATE()
       AND ms.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)`,
  );

  return rows.map((row) => {
    const days = toNumber(row.days_to_expiry);
    return {
      type: 'NEAR_EXPIRY',
      severity: days <= 7 ? 'CRITICAL' : 'HIGH',
      title: `${row.medicine} nearing expiry at ${row.phc}`,
      message: `Batch ${row.batch_number} expires on ${row.expiry_date}, in ${days} days, with ${toNumber(row.current_quantity)} still on hand.`,
      ...location(row),
    };
  });
}

async function bedAlerts() {
  const rows = await query(
    `SELECT
       p.name AS phc,
       d.name AS district,
       s.name AS state,
       b.total_beds,
       b.occupied_beds,
       b.available_beds,
       ROUND(100 * b.occupied_beds / b.total_beds, 1) AS occupancy_percentage
     FROM beds b
     JOIN phcs p ON p.id = b.phc_id
     JOIN districts d ON d.id = p.district_id
     JOIN states s ON s.id = d.state_id
     WHERE b.total_beds > 0
       AND b.occupied_beds / b.total_beds >= 0.8`,
  );

  return rows.map((row) => {
    const occupancy = toNumber(row.occupancy_percentage);
    return {
      type: 'HIGH_BED_OCCUPANCY',
      severity: occupancy >= 95 ? 'CRITICAL' : 'HIGH',
      title: `High bed occupancy at ${row.phc}`,
      message: `${toNumber(row.occupied_beds)} of ${toNumber(row.total_beds)} beds are occupied (${occupancy}%).`,
      ...location(row),
    };
  });
}

async function staffAlerts() {
  const rows = await query(
    `SELECT
       p.name AS phc,
       d.name AS district,
       s.name AS state,
       pe.name AS personnel_name,
       pe.role,
       a.status,
       a.attendance_date,
       (
         SELECT COUNT(*)
         FROM personnel_attendance recent
         WHERE recent.personnel_id = pe.id
           AND recent.attendance_date >= DATE_SUB(a.attendance_date, INTERVAL 9 DAY)
           AND recent.attendance_date <= a.attendance_date
           AND recent.status <> 'Present'
       ) AS unavailable_days
     FROM personnel_attendance a
     JOIN personnel pe ON pe.id = a.personnel_id
     JOIN phcs p ON p.id = a.phc_id
     JOIN districts d ON d.id = p.district_id
     JOIN states s ON s.id = d.state_id
     WHERE pe.role = 'Doctor'
       AND a.status <> 'Present'
       AND a.attendance_date = (
         SELECT MAX(attendance_date)
         FROM personnel_attendance
         WHERE attendance_date <= CURDATE()
       )`,
  );

  return rows.map((row) => {
    const unavailableDays = toNumber(row.unavailable_days);
    const reason = row.status === 'Leave' ? 'on leave' : 'absent';
    return {
      type: 'STAFF_SHORTAGE',
      severity: unavailableDays >= 5 ? 'HIGH' : 'MEDIUM',
      title: `Doctor unavailable at ${row.phc}`,
      message: `${row.personnel_name} is ${reason} on ${row.attendance_date} and was unavailable on ${unavailableDays} of the last 10 days.`,
      ...location(row),
    };
  });
}

async function footfallAlerts() {
  const rows = await query(
    `SELECT
       p.name AS phc,
       d.name AS district,
       s.name AS state,
       f.record_date,
       f.total_patients
     FROM patient_footfall f
     JOIN phcs p ON p.id = f.phc_id
     JOIN districts d ON d.id = p.district_id
     JOIN states s ON s.id = d.state_id
     ORDER BY p.id, f.record_date`,
  );

  const byPhc = new Map();
  for (const row of rows) {
    const key = row.phc;
    if (!byPhc.has(key)) {
      byPhc.set(key, []);
    }
    byPhc.get(key).push(row);
  }

  const alerts = [];
  for (const series of byPhc.values()) {
    const latestDate = series[series.length - 1].record_date;
    const windowStart = shiftDate(latestDate, -13);
    const recent = series.filter((row) => row.record_date >= windowStart);
    if (recent.length === 0) {
      continue;
    }

    const peak = recent.reduce((best, row) => {
      const patients = toNumber(row.total_patients);
      if (!best || patients > best.patients || (patients === best.patients && row.record_date > best.record_date)) {
        return { ...row, patients };
      }
      return best;
    }, null);

    const others = series.filter((row) => row.record_date !== peak.record_date);
    if (others.length === 0) {
      continue;
    }
    const baseline = others.reduce((sum, row) => sum + toNumber(row.total_patients), 0) / others.length;
    const ratio = peak.patients / baseline;
    if (ratio < 1.8 || peak.patients - baseline < 20) {
      continue;
    }

    alerts.push({
      type: 'FOOTFALL_SPIKE',
      severity: ratio >= 2 ? 'HIGH' : 'MEDIUM',
      title: `Patient spike at ${peak.phc}`,
      message: `On ${peak.record_date}, ${peak.phc} recorded ${peak.patients} patients, about ${ratio.toFixed(1)} times its usual daily average of ${Math.round(baseline)}.`,
      ...location(peak),
    });
  }

  return alerts;
}

async function listAlerts() {
  const groups = await Promise.all([
    medicineAlerts(),
    expiryAlerts(),
    bedAlerts(),
    staffAlerts(),
    footfallAlerts(),
  ]);

  return groups.flat().sort((left, right) => {
    const bySeverity = severityRank[left.severity] - severityRank[right.severity];
    if (bySeverity !== 0) {
      return bySeverity;
    }
    return `${left.state}|${left.district}|${left.phc}|${left.type}`.localeCompare(
      `${right.state}|${right.district}|${right.phc}|${right.type}`,
    );
  });
}

export { listAlerts };
