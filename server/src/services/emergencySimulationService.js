import { query } from '../config/db.js';
import { listAlerts } from './alertService.js';
import { listBeds } from './bedService.js';
import { getDemandForecast, getMedicineForecast } from './forecastService.js';

// In-memory simulation only. This module never inserts, updates, or deletes rows.
// Bed assumption: 5% of additional patient visits over the horizon may require a bed.
// Redistribution quantity reuses the existing excess rule (more than 180 days of supply)
// and recommends only enough stock for 30 days of the destination's simulated use.

const SCENARIO_NAME = 'Acute Respiratory Outbreak';
const SCENARIO_DESCRIPTION = 'Simulate a sudden increase in patient demand across selected PHCs and evaluate medicine, bed, and staffing pressure.';
const BED_CONVERSION_FACTOR = 0.05;
const EXCESS_DAYS = 180;
const TRANSFER_COVER_DAYS = 30;
const RISK_ORDER = ['CRITICAL', 'HIGH', 'MEDIUM', 'HEALTHY'];

function round1(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return null;
  }
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

function round2(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return null;
  }
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function medicineRisk(stockDays) {
  if (stockDays === null || stockDays === undefined) {
    return 'HEALTHY';
  }
  if (stockDays <= 3) {
    return 'CRITICAL';
  }
  if (stockDays <= 7) {
    return 'HIGH';
  }
  if (stockDays <= 14) {
    return 'MEDIUM';
  }
  return 'HEALTHY';
}

function bedRisk(occupancy) {
  if (occupancy === null || occupancy === undefined) {
    return 'HEALTHY';
  }
  if (occupancy >= 90) {
    return 'CRITICAL';
  }
  if (occupancy >= 80) {
    return 'HIGH';
  }
  if (occupancy >= 70) {
    return 'MEDIUM';
  }
  return 'HEALTHY';
}

function riskRank(risk) {
  const index = RISK_ORDER.indexOf(risk);
  return index === -1 ? RISK_ORDER.length : index;
}

async function latestAttendance() {
  const rows = await query(
    `SELECT
       p.id AS phc_id,
       SUM(a.status = 'Present') AS present_count,
       SUM(a.status = 'Absent') AS absent_count,
       SUM(a.status = 'Leave') AS on_leave_count,
       MAX(a.attendance_date) AS attendance_date
     FROM personnel_attendance a
     JOIN phcs p ON p.id = a.phc_id
     WHERE a.attendance_date = (
       SELECT MAX(attendance_date)
       FROM personnel_attendance
       WHERE attendance_date <= CURDATE()
     )
     GROUP BY p.id`,
  );
  return new Map(rows.map((row) => [row.phc_id, {
    present: Number(row.present_count) || 0,
    absent: Number(row.absent_count) || 0,
    on_leave: Number(row.on_leave_count) || 0,
    date: row.attendance_date,
  }]));
}

function simulateMedicine(row, multiplier) {
  const currentStock = Number(row.current_stock) || 0;
  const currentDailyUsage = Number(row.daily_usage) || 0;
  const simulatedDailyUsage = currentDailyUsage * multiplier;
  const simulatedStockDays = simulatedDailyUsage > 0 ? currentStock / simulatedDailyUsage : null;
  const roundedDays = round2(simulatedStockDays);
  return {
    phc_id: row.phc_id,
    phc_name: row.phc_name,
    state: row.state,
    district: row.district,
    medicine_id: row.medicine_id,
    medicine_name: row.medicine_name,
    current_stock: round2(currentStock),
    current_daily_usage: round2(currentDailyUsage),
    simulated_daily_usage: round2(simulatedDailyUsage),
    simulated_stock_days: roundedDays,
    risk: medicineRisk(roundedDays),
  };
}

function currentExcess(row) {
  const stock = Number(row.current_stock) || 0;
  const usage = Number(row.daily_usage) || 0;
  if (stock <= 0) {
    return false;
  }
  if (usage === 0) {
    return true;
  }
  return stock / usage > EXCESS_DAYS;
}

function recommendedTransfer(source, destination) {
  const reserve = source.current_daily_usage > 0 ? source.current_daily_usage * EXCESS_DAYS : 0;
  const spare = Math.floor(source.current_stock - reserve);
  const need = Math.ceil((destination.simulated_daily_usage * TRANSFER_COVER_DAYS) - destination.current_stock);
  if (spare <= 0 || need <= 0) {
    return null;
  }
  return Math.min(spare, need);
}

function buildRedistribution(medicines) {
  const shortages = medicines.filter((row) => row.risk === 'CRITICAL' && row.simulated_daily_usage > 0);
  const sources = medicines.filter((row) => currentExcess(row));
  const recommendations = [];

  for (const destination of shortages) {
    const candidates = sources
      .filter((source) => source.medicine_id === destination.medicine_id && source.phc_id !== destination.phc_id)
      .map((source) => ({ source, quantity: recommendedTransfer(source, destination) }))
      .filter((candidate) => candidate.quantity);
    candidates.sort((left, right) => right.quantity - left.quantity || right.source.current_stock - left.source.current_stock);
    const best = candidates[0];
    if (!best) {
      continue;
    }
    recommendations.push({
      source_phc: best.source.phc_name,
      source_state: best.source.state,
      source_district: best.source.district,
      destination_phc: destination.phc_name,
      destination_state: destination.state,
      destination_district: destination.district,
      medicine: destination.medicine_name,
      source_available_stock: best.source.current_stock,
      destination_simulated_stock_pressure: destination.risk,
      destination_simulated_stock_days: destination.simulated_stock_days,
      recommended_transfer_quantity: best.quantity,
      status: 'Awaiting human approval',
      transfers_executed: false,
    });
  }

  return {
    transfers_executed: false,
    recommendations,
  };
}

function classifyPhc({ medicines, projectedOccupancy, staffShortage }) {
  const pressured = medicines
    .filter((row) => row.simulated_stock_days !== null && row.risk !== 'HEALTHY')
    .sort((left, right) => riskRank(left.risk) - riskRank(right.risk) || left.simulated_stock_days - right.simulated_stock_days);
  const worst = pressured[0] || null;
  const reasons = [];

  for (const row of pressured.filter((item) => item.risk === 'CRITICAL' || item.risk === 'HIGH')) {
    reasons.push(`${row.medicine_name} simulated stock is ${row.simulated_stock_days} days.`);
  }
  if (projectedOccupancy !== null && projectedOccupancy >= 70) {
    reasons.push(`Projected bed occupancy is ${projectedOccupancy}%.`);
  }
  if (staffShortage) {
    reasons.push('Existing staff shortage from current attendance.');
  }

  const medicineCritical = medicines.some((row) => row.simulated_stock_days !== null && row.simulated_stock_days <= 3);
  const medicineHigh = medicines.some((row) => row.simulated_stock_days !== null && row.simulated_stock_days <= 7);
  let emergencyStatus = 'HEALTHY';
  if (medicineCritical || (projectedOccupancy !== null && projectedOccupancy >= 90)) {
    emergencyStatus = 'CRITICAL';
  } else if (medicineHigh || (projectedOccupancy !== null && projectedOccupancy >= 80) || staffShortage) {
    emergencyStatus = 'HIGH';
  } else if (projectedOccupancy !== null && projectedOccupancy >= 70) {
    emergencyStatus = 'MEDIUM';
  }

  if (reasons.length === 0) {
    reasons.push('No simulated medicine, bed, or staffing threshold was crossed.');
  }

  return {
    medicine_risk: worst ? worst.risk : 'HEALTHY',
    emergency_status: emergencyStatus,
    reasons,
  };
}

async function runEmergencySimulation({ demandIncreasePercent = 50, horizonDays = 7 } = {}) {
  const multiplier = 1 + (demandIncreasePercent / 100);
  const [forecast, medicineForecast, beds, alerts, attendance] = await Promise.all([
    getDemandForecast({ days: horizonDays }),
    getMedicineForecast(),
    listBeds(),
    listAlerts(),
    latestAttendance(),
  ]);

  const medicines = medicineForecast.forecasts.map((row) => simulateMedicine(row, multiplier));
  const medicinesByPhc = new Map();
  for (const row of medicines) {
    const bucket = medicinesByPhc.get(row.phc_id) || [];
    bucket.push(row);
    medicinesByPhc.set(row.phc_id, bucket);
  }

  const shortagePhcs = new Set(
    alerts.filter((alert) => alert.type === 'STAFF_SHORTAGE').map((alert) => alert.phc),
  );
  const bedsByPhc = new Map(beds.map((row) => [row.phc_id, row]));
  const forecastByPhc = new Map(forecast.phcs.map((row) => [row.phc_id, row]));

  const phcIds = new Set([
    ...forecast.phcs.map((row) => row.phc_id),
    ...beds.map((row) => row.phc_id),
    ...medicines.map((row) => row.phc_id),
  ]);

  const phcs = [...phcIds].map((phcId) => {
    const visit = forecastByPhc.get(phcId);
    const bed = bedsByPhc.get(phcId);
    const phcMedicines = medicinesByPhc.get(phcId) || [];
    const sample = visit || phcMedicines[0] || bed;
    const baselineDailyVisits = visit?.forecast?.average_daily_visits ?? visit?.historical?.recent_7_day_average ?? 0;
    const simulatedDailyVisits = baselineDailyVisits * multiplier;
    const simulated7DayVisits = simulatedDailyVisits * horizonDays;
    const baseline7DayVisits = baselineDailyVisits * horizonDays;
    const additionalVisits = Math.max(0, simulated7DayVisits - baseline7DayVisits);
    const additionalBeds = additionalVisits * BED_CONVERSION_FACTOR;
    const totalBeds = bed?.total_beds ?? 0;
    const availableBeds = bed?.available_beds ?? 0;
    const currentOccupied = totalBeds - availableBeds;
    const projectedOccupied = totalBeds > 0
      ? Math.min(totalBeds, currentOccupied + additionalBeds)
      : currentOccupied;
    const currentOccupancy = totalBeds > 0 ? (currentOccupied / totalBeds) * 100 : null;
    const projectedOccupancy = totalBeds > 0 ? (projectedOccupied / totalBeds) * 100 : null;
    const roundedProjected = round1(projectedOccupancy);
    const staff = attendance.get(phcId) || { present: 0, absent: 0, on_leave: 0, date: null };
    const phcName = visit?.phc_name || phcMedicines[0]?.phc_name || bed?.phc;
    const staffShortage = shortagePhcs.has(phcName);
    const classified = classifyPhc({
      medicines: phcMedicines,
      projectedOccupancy: roundedProjected,
      staffShortage,
    });

    return {
      phc_id: phcId,
      phc_name: phcName,
      state: visit?.state || phcMedicines[0]?.state || bed?.state,
      district: visit?.district || phcMedicines[0]?.district || bed?.district,
      baseline_daily_visits: round1(baselineDailyVisits),
      simulated_daily_visits: round1(simulatedDailyVisits),
      simulated_7_day_visits: round1(simulated7DayVisits),
      medicine_risk: classified.medicine_risk,
      current_occupancy: round1(currentOccupancy),
      currentOccupancy: round1(currentOccupancy),
      projected_bed_occupancy: roundedProjected,
      projectedOccupancy: roundedProjected,
      additional_visits: round1(additionalVisits),
      additionalVisits: round1(additionalVisits),
      additional_beds_needed: round1(additionalBeds),
      estimatedAdditionalBeds: round1(additionalBeds),
      total_beds: totalBeds,
      current_occupied_beds: currentOccupied,
      currentOccupiedBeds: currentOccupied,
      projected_occupied_beds: round1(projectedOccupied),
      projectedOccupiedBeds: round1(projectedOccupied),
      bed_risk: bedRisk(roundedProjected),
      bedRisk: bedRisk(roundedProjected),
      staff_status: staffShortage ? 'SHORTAGE' : 'AVAILABLE',
      staff_attendance: staff,
      emergency_status: classified.emergency_status,
      reasons: classified.reasons,
    };
  }).sort((left, right) => (
    riskRank(left.emergency_status) - riskRank(right.emergency_status)
    || left.state.localeCompare(right.state)
    || left.phc_name.localeCompare(right.phc_name)
  ));

  const medicinePressure = medicines
    .filter((row) => row.risk !== 'HEALTHY')
    .sort((left, right) => (
      riskRank(left.risk) - riskRank(right.risk)
      || (left.simulated_stock_days ?? Number.POSITIVE_INFINITY) - (right.simulated_stock_days ?? Number.POSITIVE_INFINITY)
      || left.phc_name.localeCompare(right.phc_name)
    ));

  const bedPressure = phcs
    .map((row) => ({
      phc_id: row.phc_id,
      phc_name: row.phc_name,
      state: row.state,
      district: row.district,
      current_occupancy: row.current_occupancy,
      additional_visits: row.additional_visits,
      additional_beds_needed: row.additional_beds_needed,
      projected_occupancy: row.projected_bed_occupancy,
      risk: row.bed_risk,
    }))
    .sort((left, right) => riskRank(left.risk) - riskRank(right.risk) || (right.projected_occupancy ?? -1) - (left.projected_occupancy ?? -1));

  return {
    scenario: {
      name: SCENARIO_NAME,
      description: SCENARIO_DESCRIPTION,
      demandIncreasePercent,
      horizonDays,
      bed_conversion_factor: BED_CONVERSION_FACTOR,
      assumption: '5% of additional patient visits over the horizon may require a bed. Projected occupied beds cannot exceed the PHC\'s real bed total. Medicine daily usage is scaled by the same demand increase. Redistribution quantities are recommendations only.',
    },
    summary: {
      totalPhcs: phcs.length,
      criticalPhcs: phcs.filter((row) => row.emergency_status === 'CRITICAL').length,
      highRiskPhcs: phcs.filter((row) => row.emergency_status === 'HIGH').length,
      medicinePressurePhcs: new Set(medicinePressure.map((row) => row.phc_id)).size,
      bedPressurePhcs: phcs.filter((row) => row.bed_risk !== 'HEALTHY').length,
    },
    phcs,
    medicine_pressure: medicinePressure,
    bed_pressure: bedPressure,
    redistribution: buildRedistribution(medicines),
    database_modified: false,
  };
}

export { runEmergencySimulation, BED_CONVERSION_FACTOR };
