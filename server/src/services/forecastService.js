import { query } from '../config/db.js';
import { toNumber } from '../utils/http.js';
import { appendScope } from '../auth/scopeSql.js';

const HISTORY_DAYS = 30;
const BASELINE_DAYS = 7;
const RISK_ORDER = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'HEALTHY'];

const RECOMMENDATIONS = {
  CRITICAL: 'Immediate redistribution or replenishment required.',
  HIGH: 'Plan replenishment within 7 days.',
  MEDIUM: 'Monitor demand and prepare replenishment.',
  LOW: 'Continue monitoring.',
  HEALTHY: 'No immediate action required.',
};

const STOCK_OUT_WINDOW = {
  CRITICAL: '3 days',
  HIGH: '7 days',
  MEDIUM: '14 days',
  LOW: '30 days',
};

function round1(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return null;
  }
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

function addDays(isoDate, count) {
  const [year, month, day] = String(isoDate).split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}

function placeFilters({ phcId, state, district, access } = {}) {
  const conditions = [];
  const params = {};
  if (phcId) {
    conditions.push('p.id = :phcId');
    params.phcId = phcId;
  }
  if (state) {
    conditions.push('s.name = :state');
    params.state = state;
  }
  if (district) {
    conditions.push('d.name = :district');
    params.district = district;
  }
  appendScope(conditions, params, access);
  return { conditions, params };
}

function classifyStockRisk(stockOutDays) {
  if (stockOutDays === null) {
    return 'HEALTHY';
  }
  if (stockOutDays <= 3) {
    return 'CRITICAL';
  }
  if (stockOutDays <= 7) {
    return 'HIGH';
  }
  if (stockOutDays <= 14) {
    return 'MEDIUM';
  }
  if (stockOutDays <= 30) {
    return 'LOW';
  }
  return 'HEALTHY';
}

function summarizeRisks(forecasts) {
  const summary = {
    total_medicines: forecasts.length,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    healthy: 0,
  };
  for (const row of forecasts) {
    summary[row.risk.toLowerCase()] += 1;
  }
  return summary;
}

async function loadFootfallRows(filters) {
  const { conditions, params } = placeFilters(filters);
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const latestRows = await query(
    `SELECT MAX(f.record_date) AS latest
     FROM patient_footfall f
     JOIN phcs p ON p.id = f.phc_id
     JOIN districts d ON d.id = p.district_id
     JOIN states s ON s.id = d.state_id
     ${where}`,
    params,
  );
  const latest = latestRows[0]?.latest;
  if (!latest) {
    return [];
  }

  const start = addDays(latest, -(HISTORY_DAYS - 1));
  const rows = await query(
    `SELECT
       p.id AS phc_id,
       p.name AS phc_name,
       s.name AS state,
       d.name AS district,
       f.record_date,
       f.total_patients
     FROM patient_footfall f
     JOIN phcs p ON p.id = f.phc_id
     JOIN districts d ON d.id = p.district_id
     JOIN states s ON s.id = d.state_id
     WHERE f.record_date >= :startDate
       AND f.record_date <= :latestDate
       ${conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : ''}
     ORDER BY p.id, f.record_date`,
    { ...params, startDate: start, latestDate: latest },
  );

  return rows.map((row) => ({
    phc_id: row.phc_id,
    phc_name: row.phc_name,
    state: row.state,
    district: row.district,
    date: row.record_date,
    total_patients: toNumber(row.total_patients) ?? 0,
  }));
}

function buildPhcForecast(rows, forecastDays) {
  const sample = rows[0];
  const history = rows.slice(-HISTORY_DAYS);
  const totalVisits = history.reduce((sum, row) => sum + row.total_patients, 0);
  const recent = history.slice(-BASELINE_DAYS);
  const hasPreviousWindow = history.length >= BASELINE_DAYS * 2 && recent.length === BASELINE_DAYS;
  const previous = hasPreviousWindow ? history.slice(-BASELINE_DAYS * 2, -BASELINE_DAYS) : [];
  const recentAverage = recent.length > 0 ? recent.reduce((sum, row) => sum + row.total_patients, 0) / recent.length : null;
  const previousAverage = previous.length === BASELINE_DAYS
    ? previous.reduce((sum, row) => sum + row.total_patients, 0) / previous.length
    : null;
  const trendPercent = previousAverage && previousAverage > 0 && recentAverage !== null
    ? ((recentAverage - previousAverage) / previousAverage) * 100
    : null;

  return {
    phc_id: sample.phc_id,
    phc_name: sample.phc_name,
    state: sample.state,
    district: sample.district,
    historical: {
      total_visits: totalVisits,
      average_daily_visits: round1(history.length > 0 ? totalVisits / history.length : null),
      recent_7_day_average: round1(recentAverage),
      previous_7_day_average: round1(previousAverage),
      trend_percent: round1(trendPercent),
    },
    forecast: {
      next_7_day_visits: round1(recentAverage === null ? null : recentAverage * forecastDays),
      average_daily_visits: round1(recentAverage),
    },
  };
}

async function getDemandForecast({ phcId, state, district, days = 7, access } = {}) {
  const rows = await loadFootfallRows({ phcId, state, district, access });
  const grouped = new Map();
  for (const row of rows) {
    const bucket = grouped.get(row.phc_id) || [];
    bucket.push(row);
    grouped.set(row.phc_id, bucket);
  }

  const phcs = [...grouped.values()]
    .map((history) => buildPhcForecast(history, days))
    .sort((left, right) => (
      left.state.localeCompare(right.state)
      || left.district.localeCompare(right.district)
      || left.phc_name.localeCompare(right.phc_name)
    ));

  return {
    generated_at: new Date().toISOString(),
    forecast_days: days,
    phcs,
  };
}

async function loadMedicineRows(filters) {
  const { conditions, params } = placeFilters(filters);
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = await query(
    `SELECT
       p.id AS phc_id,
       p.name AS phc_name,
       s.name AS state,
       d.name AS district,
       m.id AS medicine_id,
       m.name AS medicine_name,
       SUM(ms.current_quantity) AS current_stock,
       SUM(ms.daily_average_usage) AS daily_usage
     FROM medicine_stock ms
     JOIN phcs p ON p.id = ms.phc_id
     JOIN districts d ON d.id = p.district_id
     JOIN states s ON s.id = d.state_id
     JOIN medicines m ON m.id = ms.medicine_id
     ${where}
     GROUP BY p.id, p.name, s.name, d.name, m.id, m.name`,
    params,
  );

  return rows.map((row) => {
    const currentStock = toNumber(row.current_stock) ?? 0;
    const dailyUsage = toNumber(row.daily_usage) ?? 0;
    const stockOutDays = dailyUsage > 0 ? currentStock / dailyUsage : null;
    const risk = classifyStockRisk(stockOutDays === null ? null : round1(stockOutDays));
    return {
      phc_id: row.phc_id,
      phc_name: row.phc_name,
      state: row.state,
      district: row.district,
      medicine_id: row.medicine_id,
      medicine_name: row.medicine_name,
      current_stock: round1(currentStock),
      daily_usage: round1(dailyUsage),
      current_stock_days: round1(stockOutDays),
      projected_stock_7_days: round1(currentStock - (dailyUsage * 7)),
      projected_stock_out_days: round1(stockOutDays),
      risk,
      recommendation: RECOMMENDATIONS[risk],
    };
  });
}

function sortForecasts(forecasts) {
  return [...forecasts].sort((left, right) => {
    const riskGap = RISK_ORDER.indexOf(left.risk) - RISK_ORDER.indexOf(right.risk);
    if (riskGap !== 0) {
      return riskGap;
    }
    const leftDays = left.projected_stock_out_days ?? Number.POSITIVE_INFINITY;
    const rightDays = right.projected_stock_out_days ?? Number.POSITIVE_INFINITY;
    if (leftDays !== rightDays) {
      return leftDays - rightDays;
    }
    return left.state.localeCompare(right.state)
      || left.phc_name.localeCompare(right.phc_name)
      || left.medicine_name.localeCompare(right.medicine_name);
  });
}

async function getMedicineForecast({ phcId, state, district, risk, access } = {}) {
  const forecasts = sortForecasts(await loadMedicineRows({ phcId, state, district, access }));
  const summary = summarizeRisks(forecasts);
  const visible = risk ? forecasts.filter((row) => row.risk === risk) : forecasts;
  return { summary, forecasts: visible };
}

function stockOutAlert(row) {
  if (!STOCK_OUT_WINDOW[row.risk] || row.projected_stock_out_days === null) {
    return null;
  }
  return {
    alert_type: 'FORECAST_STOCK_OUT',
    severity: row.risk,
    phc_id: row.phc_id,
    phc_name: row.phc_name,
    state: row.state,
    district: row.district,
    medicine_id: row.medicine_id,
    medicine_name: row.medicine_name,
    projected_stock_out_days: row.projected_stock_out_days,
    message: `${row.medicine_name} stock is projected to run out within ${STOCK_OUT_WINDOW[row.risk]}.`,
  };
}

function footfallSpikeAlert(phc) {
  const trend = phc.historical.trend_percent;
  const previous = phc.historical.previous_7_day_average;
  if (trend === null || previous === null || previous <= 0) {
    return null;
  }
  if (trend < 20) {
    return null;
  }
  return {
    alert_type: 'FORECAST_FOOTFALL_SPIKE',
    severity: trend >= 40 ? 'CRITICAL' : 'HIGH',
    phc_id: phc.phc_id,
    phc_name: phc.phc_name,
    state: phc.state,
    district: phc.district,
    medicine_name: null,
    trend_percent: trend,
    message: `${phc.phc_name} patient demand is ${trend}% above the previous 7 days.`,
  };
}

async function getForecastAlerts({ phcId, state, district, access } = {}) {
  const [demand, medicines] = await Promise.all([
    getDemandForecast({ phcId, state, district, days: 7, access }),
    loadMedicineRows({ phcId, state, district, access }),
  ]);

  const alerts = [
    ...sortForecasts(medicines).map(stockOutAlert),
    ...demand.phcs.map(footfallSpikeAlert),
  ].filter(Boolean);

  const severityRank = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  alerts.sort((left, right) => (
    (severityRank[left.severity] ?? 9) - (severityRank[right.severity] ?? 9)
    || String(left.phc_name).localeCompare(String(right.phc_name))
  ));

  return alerts;
}

export { getDemandForecast, getMedicineForecast, getForecastAlerts };
