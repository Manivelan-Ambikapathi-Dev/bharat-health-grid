import { deriveResourceStatus } from './stateStatus.js';

const MEDICINE_ALERTS = new Set(['MEDICINE_STOCK_OUT', 'LOW_STOCK', 'NEAR_EXPIRY']);

function sumBy(rows, field) {
  return rows.reduce((total, row) => total + (Number(row[field]) || 0), 0);
}

function occupancyPercent(occupied, total) {
  if (!total) {
    return 0;
  }
  return Math.round((occupied / total) * 1000) / 10;
}

function stockCounts(rows) {
  return {
    critical: rows.filter((row) => row.stock_status === 'CRITICAL').length,
    low: rows.filter((row) => row.stock_status === 'LOW').length,
  };
}

function medicineRisk(stockRows, alerts) {
  const counts = stockCounts(stockRows);
  const medicineAlerts = alerts.filter((alert) => MEDICINE_ALERTS.has(alert.type));
  return deriveResourceStatus(medicineAlerts, counts.critical, counts.low);
}

function staffStatus(alerts) {
  const staffAlerts = alerts.filter((alert) => alert.type === 'STAFF_SHORTAGE');
  return deriveResourceStatus(staffAlerts, 0, 0);
}

function samePlace(row, stateName, districtName) {
  return row.state === stateName && (!districtName || row.district === districtName);
}

function buildDistrictRows({ stateName, phcs, beds, stock, alerts, footfall }) {
  const statePhcs = phcs.filter((phc) => phc.state === stateName);
  const districts = [...new Set(statePhcs.map((phc) => phc.district))].sort((left, right) => left.localeCompare(right));

  return districts.map((district) => {
    const districtPhcs = statePhcs.filter((phc) => phc.district === district);
    const districtBeds = beds.filter((row) => samePlace(row, stateName, district));
    const districtStock = stock.filter((row) => samePlace(row, stateName, district));
    const districtAlerts = alerts.filter((row) => samePlace(row, stateName, district));
    const districtFootfall = footfall.filter((row) => samePlace(row, stateName, district));
    const counts = stockCounts(districtStock);
    const totalBeds = sumBy(districtBeds, 'total_beds');
    const occupiedBeds = sumBy(districtBeds, 'occupied_beds');

    return {
      district,
      state: stateName,
      phcCount: districtPhcs.length,
      footfall: sumBy(districtFootfall, 'total_patients'),
      availableBeds: sumBy(districtBeds, 'available_beds'),
      occupancy: occupancyPercent(occupiedBeds, totalBeds),
      criticalAlerts: districtAlerts.filter((alert) => alert.severity === 'CRITICAL').length,
      status: deriveResourceStatus(districtAlerts, counts.critical, counts.low),
    };
  });
}

function buildPhcRows({ stateName, districtName, phcs, beds, stock, alerts, footfall }) {
  return phcs
    .filter((phc) => phc.state === stateName && phc.district === districtName)
    .map((phc) => {
      const phcBeds = beds.find((row) => row.phc_id === phc.id);
      const phcStock = stock.filter((row) => row.phc_id === phc.id);
      const phcAlerts = alerts.filter((row) => row.phc === phc.name && row.district === districtName);
      const phcFootfall = footfall.filter((row) => row.phc_id === phc.id);
      const counts = stockCounts(phcStock);

      return {
        id: phc.id,
        name: phc.name,
        phcCode: phc.phc_code,
        population: phc.population_covered,
        footfall: sumBy(phcFootfall, 'total_patients'),
        availableBeds: phcBeds ? phcBeds.available_beds : 0,
        medicineRisk: medicineRisk(phcStock, phcAlerts),
        staffStatus: staffStatus(phcAlerts),
        status: deriveResourceStatus(phcAlerts, counts.critical, counts.low),
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

export { buildDistrictRows, buildPhcRows, medicineRisk, staffStatus };
