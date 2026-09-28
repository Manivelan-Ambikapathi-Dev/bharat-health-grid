import { query } from '../config/db.js';
import { toNumber } from '../utils/http.js';
import { listAlerts } from '../services/alertService.js';
import { listBeds } from '../services/bedService.js';
import { listFootfall } from '../services/footfallService.js';
import { listMedicineStock } from '../services/medicineStockService.js';
import { listPhcs } from '../services/phcService.js';
import { filterRowsByScope, scopeAnd } from '../auth/scopeSql.js';

function daysBetween(fromIso, toIso) {
  const from = Date.parse(`${fromIso}T00:00:00Z`);
  const to = Date.parse(`${toIso}T00:00:00Z`);
  return Math.round((to - from) / 86400000);
}

function average(values) {
  if (values.length === 0) {
    return null;
  }
  const total = values.reduce((sum, value) => sum + value, 0);
  return Math.round((total / values.length) * 10) / 10;
}

function stockRecord(row, asOf, phc) {
  const daysToExpiry = daysBetween(asOf, row.expiry_date);
  const mayExpireBeforeUse = row.stock_days !== null && daysToExpiry >= 0 && row.stock_days > daysToExpiry;
  return {
    phc: row.phc,
    phc_code: phc?.phc_code || null,
    district: row.district,
    state: row.state,
    latitude: phc?.latitude ?? null,
    longitude: phc?.longitude ?? null,
    medicine: row.medicine,
    generic_name: row.generic_name,
    batch_number: row.batch_number,
    current_quantity: row.current_quantity,
    daily_average_usage: row.daily_average_usage,
    stock_days: row.stock_days,
    stock_status: row.stock_status,
    expiry_date: row.expiry_date,
    days_to_expiry: daysToExpiry,
    may_expire_before_use: mayExpireBeforeUse,
    reorder_level: row.reorder_level,
  };
}

function needsAttention(record) {
  if (record.stock_status !== 'HEALTHY') {
    return true;
  }
  return record.days_to_expiry >= 0 && record.days_to_expiry <= 30;
}

function summarizeFootfall(rows) {
  const byPhc = new Map();
  for (const row of rows) {
    const series = byPhc.get(row.phc_id) || [];
    series.push(row);
    byPhc.set(row.phc_id, series);
  }

  const phcTrends = [];
  const spikes = [];
  for (const series of byPhc.values()) {
    const ordered = [...series].sort((left, right) => left.date.localeCompare(right.date));
    const recent = ordered.slice(-7);
    const earlier = ordered.slice(0, Math.max(0, ordered.length - 7));
    const recentAverage = average(recent.map((row) => row.total_patients));
    const earlierAverage = average(earlier.map((row) => row.total_patients));
    const sample = ordered[0];
    phcTrends.push({
      phc: sample.phc,
      district: sample.district,
      state: sample.state,
      recent_7_day_average: recentAverage,
      earlier_average: earlierAverage,
      change_ratio: earlierAverage ? Math.round((recentAverage / earlierAverage) * 100) / 100 : null,
    });

    const latestDate = ordered[ordered.length - 1].date;
    const windowStart = new Date(`${latestDate}T00:00:00Z`);
    windowStart.setUTCDate(windowStart.getUTCDate() - 13);
    const windowIso = windowStart.toISOString().slice(0, 10);
    const recentDays = ordered.filter((row) => row.date >= windowIso);
    const peak = recentDays.reduce((best, row) => {
      if (!best || row.total_patients > best.total_patients) {
        return row;
      }
      return best;
    }, null);
    if (!peak) {
      continue;
    }
    const others = ordered.filter((row) => row.date !== peak.date);
    const baseline = average(others.map((row) => row.total_patients));
    if (baseline && peak.total_patients >= baseline * 1.8 && peak.total_patients - baseline >= 20) {
      spikes.push({
        phc: peak.phc,
        district: peak.district,
        state: peak.state,
        date: peak.date,
        total_patients: peak.total_patients,
        usual_daily_average: Math.round(baseline),
        ratio: Math.round((peak.total_patients / baseline) * 10) / 10,
      });
    }
  }

  const byDistrict = new Map();
  for (const trend of phcTrends) {
    const key = `${trend.state}|${trend.district}`;
    const bucket = byDistrict.get(key) || [];
    bucket.push(trend);
    byDistrict.set(key, bucket);
  }

  const districtTrends = [...byDistrict.values()].map((bucket) => ({
    district: bucket[0].district,
    state: bucket[0].state,
    phc_count: bucket.length,
    recent_7_day_average: average(bucket.map((item) => item.recent_7_day_average)),
    earlier_average: average(bucket.map((item) => item.earlier_average).filter((value) => value !== null)),
    change_ratio: average(bucket.map((item) => item.change_ratio).filter((value) => value !== null)),
  }));

  return { phc_trends: phcTrends, district_trends: districtTrends, spikes };
}

function redistributionPairs(attention) {
  const shortages = attention.filter((row) => row.current_quantity > 0 && (row.stock_status === 'CRITICAL' || row.stock_status === 'LOW'));
  const excess = attention.filter((row) => row.current_quantity > 0 && row.stock_status === 'EXCESS');
  const pairs = [];

  for (const destination of shortages) {
    for (const source of excess) {
      if (source.medicine !== destination.medicine || source.phc === destination.phc) {
        continue;
      }
      pairs.push({
        medicine: source.medicine,
        source: {
          phc: source.phc,
          district: source.district,
          state: source.state,
          latitude: source.latitude,
          longitude: source.longitude,
          batch_number: source.batch_number,
          current_quantity: source.current_quantity,
          daily_average_usage: source.daily_average_usage,
          stock_days: source.stock_days,
          expiry_date: source.expiry_date,
          stock_status: source.stock_status,
        },
        destination: {
          phc: destination.phc,
          district: destination.district,
          state: destination.state,
          latitude: destination.latitude,
          longitude: destination.longitude,
          batch_number: destination.batch_number,
          current_quantity: destination.current_quantity,
          daily_average_usage: destination.daily_average_usage,
          stock_days: destination.stock_days,
          expiry_date: destination.expiry_date,
          stock_status: destination.stock_status,
        },
      });
    }
  }

  return pairs;
}

async function loadOperationalContext(access) {
  const scope = scopeAnd(access);
  const [asOfRows, stock, beds, phcs, alerts, footfall, unavailableStaff, attendanceCounts] = await Promise.all([
    query('SELECT CURDATE() AS as_of'),
    listMedicineStock({ access }),
    listBeds({ access }),
    listPhcs({ access }),
    listAlerts(),
    listFootfall({ access }),
    query(
      `SELECT
         p.name AS phc,
         d.name AS district,
         s.name AS state,
         pe.name AS personnel,
         pe.role,
         a.status,
         a.attendance_date
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
         )${scope.sql}`,
      scope.params,
    ),
    query(
      `SELECT
         p.name AS phc,
         d.name AS district,
         s.name AS state,
         SUM(a.status = 'Present') AS present_count,
         SUM(a.status = 'Absent') AS absent_count,
         SUM(a.status = 'Leave') AS on_leave_count
       FROM personnel_attendance a
       JOIN phcs p ON p.id = a.phc_id
       JOIN districts d ON d.id = p.district_id
       JOIN states s ON s.id = d.state_id
       WHERE a.attendance_date = (
         SELECT MAX(attendance_date)
         FROM personnel_attendance
         WHERE attendance_date <= CURDATE()
       )${scope.sql}
       GROUP BY p.id, p.name, d.name, s.name
       ORDER BY s.name, d.name, p.name`,
      scope.params,
    ),
  ]);

  if (phcs.length === 0 || stock.length === 0) {
    return null;
  }

  const asOf = asOfRows[0].as_of;
  const phcById = new Map(phcs.map((phc) => [phc.id, phc]));
  const attention = stock
    .map((row) => stockRecord(row, asOf, phcById.get(row.phc_id)))
    .filter(needsAttention);

  const footfallSummary = summarizeFootfall(footfall);
  const pairs = redistributionPairs(attention);

  return {
    as_of: asOf,
    known_phcs: phcs.map((phc) => phc.name),
    known_districts: [...new Set(phcs.map((phc) => phc.district))],
    forRiskAnalysis: {
      as_of: asOf,
      stock_definitions: {
        OUT_OF_STOCK: 'current quantity is 0',
        CRITICAL: 'more than 0 and at most 3 days of supply',
        LOW: 'more than 3 and at most 7 days of supply',
        EXCESS: 'more than 180 days of supply',
        may_expire_before_use: 'days of supply exceed days until expiry',
      },
      medicine_attention: attention,
      beds: beds.map((bed) => ({
        phc: bed.phc,
        district: bed.district,
        state: bed.state,
        total_beds: bed.total_beds,
        occupied_beds: bed.occupied_beds,
        available_beds: bed.available_beds,
        occupancy_percentage: bed.occupancy_percentage,
      })),
      staff: {
        doctors_unavailable: unavailableStaff.map((row) => ({
          phc: row.phc,
          district: row.district,
          state: row.state,
          personnel: row.personnel,
          role: row.role,
          status: row.status,
          date: row.attendance_date,
        })),
        attendance_by_phc: attendanceCounts.map((row) => ({
          phc: row.phc,
          district: row.district,
          state: row.state,
          present_count: toNumber(row.present_count),
          absent_count: toNumber(row.absent_count),
          on_leave_count: toNumber(row.on_leave_count),
        })),
      },
      footfall: footfallSummary,
      deterministic_alerts: filterRowsByScope(alerts, access),
    },
    redistributionPairs: pairs,
    forQuery: null,
  };
}

function withQueryView(context) {
  return {
    ...context,
    forQuery: {
      as_of: context.as_of,
      medicine_attention: context.forRiskAnalysis.medicine_attention,
      beds: context.forRiskAnalysis.beds,
      staff: context.forRiskAnalysis.staff,
      footfall_spikes: context.forRiskAnalysis.footfall.spikes,
      district_footfall: context.forRiskAnalysis.footfall.district_trends,
      deterministic_alerts: context.forRiskAnalysis.deterministic_alerts,
      omitted: 'Healthy medicine batches with expiry beyond 30 days are omitted.',
    },
  };
}

export { loadOperationalContext, withQueryView };
