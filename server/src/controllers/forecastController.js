import { getDemandForecast, getForecastAlerts, getMedicineForecast } from '../services/forecastService.js';
import { createHttpError, positiveIntQuery, textQuery } from '../utils/http.js';

const FORECAST_RISKS = new Set(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'HEALTHY']);

function placeFilters(query, access) {
  return {
    phcId: positiveIntQuery(query.phc_id, 'phc_id'),
    state: textQuery(query.state),
    district: textQuery(query.district),
    access,
  };
}

async function getForecastHandler(req, res) {
  const filters = placeFilters(req.query, req.user);
  const days = positiveIntQuery(req.query.days, 'days') ?? 7;
  if (days > 30) {
    throw createHttpError(400, 'days must be between 1 and 30');
  }

  const data = await getDemandForecast({ ...filters, days });
  res.json({ success: true, data });
}

async function getMedicineForecastHandler(req, res) {
  const filters = placeFilters(req.query, req.user);
  const riskText = textQuery(req.query.risk);
  const risk = riskText ? riskText.toUpperCase() : undefined;
  if (risk && !FORECAST_RISKS.has(risk)) {
    throw createHttpError(400, 'risk must be CRITICAL, HIGH, MEDIUM, LOW, or HEALTHY');
  }

  const data = await getMedicineForecast({ ...filters, risk });
  res.json({ success: true, data });
}

async function getForecastAlertsHandler(req, res) {
  const data = await getForecastAlerts(placeFilters(req.query, req.user));
  res.json({ success: true, data });
}

export { getForecastHandler, getMedicineForecastHandler, getForecastAlertsHandler };
