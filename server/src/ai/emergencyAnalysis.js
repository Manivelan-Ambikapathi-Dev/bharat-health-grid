import { createHttpError } from '../utils/http.js';
import { runEmergencySimulation } from '../services/emergencySimulationService.js';
import { generateStructuredJson } from './geminiClient.js';
import {
  buildEmergencyAnalysisPrompt,
  emergencyAnalysisSchema,
  emergencyAnalysisSystemInstruction,
} from './prompts/emergencyAnalysisPrompt.js';
import { validateEmergencyAnalysis } from './validateAiResponse.js';

const MAX_ITEMS = 500;

function compactSimulation(result) {
  return [
    {
      record_type: 'scenario',
      name: result.scenario.name,
      demand_increase_percent: result.scenario.demandIncreasePercent,
      horizon_days: result.scenario.horizonDays,
      assumption: result.scenario.assumption,
      database_modified: false,
    },
    { record_type: 'summary', ...result.summary },
    ...result.phcs.map((row) => ({
      record_type: 'phc',
      phc_name: row.phc_name,
      state: row.state,
      district: row.district,
      simulated_daily_visits: row.simulated_daily_visits,
      medicine_risk: row.medicine_risk,
      projected_bed_occupancy: row.projected_bed_occupancy,
      staff_status: row.staff_status,
      emergency_status: row.emergency_status,
      reasons: row.reasons,
    })),
    ...result.medicine_pressure.filter((row) => row.risk === 'CRITICAL' || row.risk === 'HIGH').map((row) => ({
      record_type: 'medicine_pressure',
      phc_name: row.phc_name,
      medicine_name: row.medicine_name,
      current_stock: row.current_stock,
      current_daily_usage: row.current_daily_usage,
      simulated_daily_usage: row.simulated_daily_usage,
      simulated_stock_days: row.simulated_stock_days,
      risk: row.risk,
    })),
    ...result.redistribution.recommendations.map((row) => ({
      record_type: 'redistribution',
      ...row,
    })),
  ];
}

function readSimulationData(value) {
  if (!Array.isArray(value)) {
    throw createHttpError(400, 'simulationData must be an array.');
  }
  if (value.length === 0) {
    throw createHttpError(400, 'simulationData must be a non-empty array.');
  }
  if (value.length > MAX_ITEMS) {
    throw createHttpError(400, 'simulationData is too large.');
  }
  return value.filter((item) => item && typeof item === 'object' && !Array.isArray(item));
}

async function analyzeEmergency(body = {}) {
  let scenario = body?.scenario;
  let simulationData = body && Object.prototype.hasOwnProperty.call(body, 'simulationData')
    ? body.simulationData
    : undefined;

  if (simulationData === undefined) {
    const result = await runEmergencySimulation({ demandIncreasePercent: 50, horizonDays: 7 });
    scenario = {
      name: result.scenario.name,
      demand_increase_percent: result.scenario.demandIncreasePercent,
      horizon_days: result.scenario.horizonDays,
    };
    simulationData = compactSimulation(result);
  } else {
    simulationData = readSimulationData(simulationData);
  }

  if (!scenario || typeof scenario !== 'object') {
    throw createHttpError(400, 'scenario is required.');
  }

  const generated = await generateStructuredJson({
    systemInstruction: emergencyAnalysisSystemInstruction,
    userPrompt: buildEmergencyAnalysisPrompt(scenario, simulationData),
    responseSchema: emergencyAnalysisSchema,
  });

  return validateEmergencyAnalysis(generated, simulationData);
}

export { analyzeEmergency, compactSimulation };
