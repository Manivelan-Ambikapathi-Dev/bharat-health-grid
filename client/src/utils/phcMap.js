import { medicineRisk, staffStatus } from './hierarchy.js';
import { resolvePhcPosition } from './phcCoordinates.js';
import { deriveResourceStatus } from './stateStatus.js';

function stockCounts(rows) {
  return {
    critical: rows.filter((row) => row.stock_status === 'CRITICAL').length,
    low: rows.filter((row) => row.stock_status === 'LOW').length,
  };
}

function buildMapPoints({ phcs, beds, stock, alerts }) {
  return phcs.flatMap((phc) => {
    const position = resolvePhcPosition(phc);
    if (!position) {
      return [];
    }
    const phcStock = stock.filter((row) => row.phc_id === phc.id);
    const phcAlerts = alerts.filter((row) => row.phc === phc.name);
    const counts = stockCounts(phcStock);
    const phcBeds = beds.find((row) => row.phc_id === phc.id);

    return [{
      id: phc.id,
      name: phc.name,
      phcCode: phc.phc_code,
      state: phc.state,
      district: phc.district,
      availableBeds: phcBeds ? phcBeds.available_beds : 0,
      medicineRisk: medicineRisk(phcStock, phcAlerts),
      staffStatus: staffStatus(phcAlerts),
      status: deriveResourceStatus(phcAlerts, counts.critical, counts.low),
      position,
    }];
  });
}

function countByStatus(points) {
  return {
    total: points.length,
    critical: points.filter((point) => point.status === 'critical').length,
    attention: points.filter((point) => point.status === 'attention').length,
    normal: points.filter((point) => point.status === 'normal').length,
  };
}

export { buildMapPoints, countByStatus };
