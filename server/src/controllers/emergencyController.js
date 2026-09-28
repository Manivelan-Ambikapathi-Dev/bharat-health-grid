import { runEmergencySimulation } from '../services/emergencySimulationService.js';
import { createHttpError } from '../utils/http.js';

const ALLOWED_INCREASES = new Set([10, 25, 50, 100]);

function demandIncrease(body) {
  if (!body || body.demandIncreasePercent === undefined || body.demandIncreasePercent === null) {
    return 50;
  }
  const value = Number(body.demandIncreasePercent);
  if (!ALLOWED_INCREASES.has(value)) {
    throw createHttpError(400, 'demandIncreasePercent must be 10, 25, 50, or 100');
  }
  return value;
}

function horizonDays(body) {
  if (!body || body.horizonDays === undefined || body.horizonDays === null) {
    return 7;
  }
  const value = Number(body.horizonDays);
  if (value !== 7) {
    throw createHttpError(400, 'horizonDays must be 7');
  }
  return 7;
}

async function postEmergencySimulation(req, res) {
  const data = await runEmergencySimulation({
    demandIncreasePercent: demandIncrease(req.body),
    horizonDays: horizonDays(req.body),
  });
  res.json({ success: true, data });
}

export { postEmergencySimulation };
