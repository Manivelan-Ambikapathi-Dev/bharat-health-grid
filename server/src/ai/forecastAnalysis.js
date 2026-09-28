import { createHttpError } from '../utils/http.js';
import { getDemandForecast, getMedicineForecast } from '../services/forecastService.js';
import { ROLES } from '../constants/roles.js';
import { generateStructuredJson } from './geminiClient.js';
import {
  buildForecastAnalysisPrompt,
  forecastAnalysisSchema,
  forecastAnalysisSystemInstruction,
} from './prompts/forecastAnalysisPrompt.js';
import { validateForecastAnalysis } from './validateAiResponse.js';

const MAX_ITEMS = 500;

function compactForecastData(value) {
  if (!Array.isArray(value)) {
    throw createHttpError(400, 'forecastData must be an array.');
  }
  if (value.length === 0) {
    throw createHttpError(400, 'forecastData must be a non-empty array.');
  }
  if (value.length > MAX_ITEMS) {
    throw createHttpError(400, 'forecastData is too large.');
  }
  return value.filter((item) => item && typeof item === 'object' && !Array.isArray(item));
}

async function loadDefaultForecastData(access) {
  const [demand, medicine] = await Promise.all([
    getDemandForecast({ days: 7, access }),
    getMedicineForecast({ access }),
  ]);
  const medicines = medicine.forecasts
    .filter((row) => row.risk !== 'HEALTHY')
    .map((row) => ({
      record_type: 'medicine_forecast',
      phc_name: row.phc_name,
      state: row.state,
      district: row.district,
      medicine_name: row.medicine_name,
      current_stock: row.current_stock,
      daily_usage: row.daily_usage,
      current_stock_days: row.current_stock_days,
      projected_stock_7_days: row.projected_stock_7_days,
      projected_stock_out_days: row.projected_stock_out_days,
      risk: row.risk,
      recommendation: row.recommendation,
    }));
  const footfall = demand.phcs.map((phc) => ({
    record_type: 'footfall_forecast',
    phc_name: phc.phc_name,
    state: phc.state,
    district: phc.district,
    recent_7_day_average: phc.historical.recent_7_day_average,
    previous_7_day_average: phc.historical.previous_7_day_average,
    trend_percent: phc.historical.trend_percent,
    next_7_day_visits: phc.forecast.next_7_day_visits,
    average_daily_visits: phc.forecast.average_daily_visits,
  }));
  return [...medicines, ...footfall];
}

function keepInScope(rows, access) {
  if (!access || access.role === ROLES.NATIONAL_ADMIN) {
    return rows;
  }
  return rows.filter((row) => {
    if (row.state !== access.stateName) {
      return false;
    }
    if ((access.role === ROLES.DISTRICT_OFFICER || access.role === ROLES.PHC_STAFF)
      && row.district !== access.districtName) {
      return false;
    }
    if (access.role === ROLES.PHC_STAFF && (row.phc_name || row.phc) !== access.phcName) {
      return false;
    }
    return true;
  });
}

async function analyzeForecast(forecastData, access) {
  const supplied = forecastData === undefined
    ? await loadDefaultForecastData(access)
    : keepInScope(compactForecastData(forecastData), access);
  if (supplied.length === 0) {
    throw createHttpError(403, 'You do not have permission to access this resource');
  }

  const generated = await generateStructuredJson({
    systemInstruction: forecastAnalysisSystemInstruction,
    userPrompt: buildForecastAnalysisPrompt(supplied),
    responseSchema: forecastAnalysisSchema,
  });

  return validateForecastAnalysis(generated, supplied);
}

export { analyzeForecast };
