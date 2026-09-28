import { createHttpError } from '../utils/http.js';

const RISK_LEVELS = new Set(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
const CATEGORIES = new Set(['MEDICINE', 'BED', 'STAFF', 'FOOTFALL']);
const PRIORITIES = new Set(['HIGH', 'MEDIUM', 'LOW']);

function unexpected() {
  throw createHttpError(502, 'The AI service returned an unexpected response.');
}

function requiredText(value, maxLength = 4000) {
  if (typeof value !== 'string') {
    unexpected();
  }
  const text = value.trim();
  if (!text || text.length > maxLength) {
    unexpected();
  }
  return text;
}

function enumValue(value, allowed) {
  if (typeof value !== 'string') {
    unexpected();
  }
  const normalized = value.trim().toUpperCase();
  if (!allowed.has(normalized)) {
    unexpected();
  }
  return normalized;
}

function stringList(value) {
  if (!Array.isArray(value)) {
    unexpected();
  }
  return value.map((item) => requiredText(item, 500));
}

function validateRiskAnalysis(value, context) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    unexpected();
  }

  const risks = Array.isArray(value.risks)
    ? value.risks.map((risk) => ({
      category: enumValue(risk?.category, CATEGORIES),
      severity: enumValue(risk?.severity, RISK_LEVELS),
      title: requiredText(risk?.title, 300),
      explanation: requiredText(risk?.explanation),
      evidence: requiredText(risk?.evidence),
    }))
    : unexpected();

  const recommendedActions = Array.isArray(value.recommended_actions)
    ? value.recommended_actions.map((item) => ({
      priority: enumValue(item?.priority, PRIORITIES),
      action: requiredText(item?.action),
      reason: requiredText(item?.reason),
    }))
    : unexpected();

  const hasSeriousAlert = context.forRiskAnalysis.deterministic_alerts.some((alert) => (
    alert.severity === 'CRITICAL' || alert.severity === 'HIGH'
  ));
  if (hasSeriousAlert && risks.length === 0) {
    unexpected();
  }

  return {
    overall_risk: enumValue(value.overall_risk, RISK_LEVELS),
    summary: requiredText(value.summary),
    risks,
    recommended_actions: recommendedActions,
  };
}

function namesMatch(left, right) {
  return String(left || '').trim().toLowerCase() === String(right || '').trim().toLowerCase();
}

function validateRedistribution(value, pairs) {
  if (!value || typeof value !== 'object' || !Array.isArray(value.recommendations)) {
    unexpected();
  }

  const recommendations = [];
  for (const item of value.recommendations) {
    const medicine = typeof item?.medicine === 'string' ? item.medicine.trim() : '';
    const sourceName = typeof item?.source_phc === 'string' ? item.source_phc.trim() : '';
    const destinationName = typeof item?.destination_phc === 'string' ? item.destination_phc.trim() : '';
    const reason = typeof item?.reason === 'string' ? item.reason.trim() : '';
    if (!medicine || !sourceName || !destinationName || !reason) {
      continue;
    }

    const pair = pairs.find((candidate) => (
      namesMatch(candidate.medicine, medicine)
      && namesMatch(candidate.source.phc, sourceName)
      && namesMatch(candidate.destination.phc, destinationName)
    ));
    if (!pair) {
      continue;
    }

    const transferQuantity = typeof item.recommended_transfer_quantity === 'number'
      ? item.recommended_transfer_quantity
      : Number(item.recommended_transfer_quantity);
    if (!Number.isFinite(transferQuantity)) {
      continue;
    }
    const wholeQuantity = Math.round(transferQuantity);
    if (wholeQuantity <= 0 || wholeQuantity > pair.source.current_quantity) {
      continue;
    }

    let priority;
    try {
      priority = enumValue(item.priority, PRIORITIES);
    } catch {
      continue;
    }

    recommendations.push({
      medicine: pair.medicine,
      source_phc: pair.source.phc,
      source_state: pair.source.state,
      source_available_quantity: pair.source.current_quantity,
      destination_phc: pair.destination.phc,
      destination_state: pair.destination.state,
      destination_current_quantity: pair.destination.current_quantity,
      destination_daily_usage: pair.destination.daily_average_usage,
      recommended_transfer_quantity: wholeQuantity,
      reason,
      priority,
    });
  }

  return recommendations;
}

function keepKnownNames(names, knownNames) {
  const known = new Map(knownNames.map((name) => [name.toLowerCase(), name]));
  const accepted = [];
  let removed = 0;
  for (const name of names) {
    const canonical = known.get(name.toLowerCase());
    if (!canonical) {
      removed += 1;
      continue;
    }
    if (!accepted.includes(canonical)) {
      accepted.push(canonical);
    }
  }
  return { accepted, removed };
}

function validateQueryAnswer(value, context) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    unexpected();
  }

  const phcs = keepKnownNames(stringList(value.relevant_phcs), context.known_phcs);
  const districts = keepKnownNames(stringList(value.relevant_districts), context.known_districts);
  const warnings = stringList(value.warnings);
  if (phcs.removed > 0 || districts.removed > 0) {
    warnings.push('Some place names were removed because they are not in the supplied data.');
  }

  return {
    answer: requiredText(value.answer),
    supporting_data: stringList(value.supporting_data),
    relevant_phcs: phcs.accepted,
    relevant_districts: districts.accepted,
    warnings,
  };
}

function normalizePlace(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/government phc,?/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function looseName(candidate, knownNames) {
  const target = normalizePlace(candidate);
  if (!target) {
    return '';
  }
  return knownNames.find((name) => {
    const known = normalizePlace(name);
    return known === target || known.includes(target) || target.includes(known);
  }) || '';
}

function collectForecastNames(forecastData, keys) {
  const names = [];
  for (const item of forecastData) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    for (const key of keys) {
      const value = item[key];
      if (typeof value === 'string' && value.trim() && !names.includes(value.trim())) {
        names.push(value.trim());
      }
    }
  }
  return names;
}

function forecastHasUrgentRisk(forecastData) {
  return forecastData.some((item) => {
    const risk = typeof item?.risk === 'string' ? item.risk.trim().toUpperCase() : '';
    const severity = typeof item?.severity === 'string' ? item.severity.trim().toUpperCase() : '';
    return risk === 'CRITICAL' || risk === 'HIGH' || severity === 'CRITICAL' || severity === 'HIGH';
  });
}

function optionalText(value, maxLength = 300) {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value !== 'string') {
    unexpected();
  }
  const text = value.trim();
  if (text.length > maxLength) {
    unexpected();
  }
  return text;
}

function validateForecastAnalysis(value, forecastData) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    unexpected();
  }

  const knownPhcs = collectForecastNames(forecastData, ['phc_name', 'phc']);
  const knownMedicines = collectForecastNames(forecastData, ['medicine_name', 'medicine']);
  const suppliedActions = Array.isArray(value.priority_actions) ? value.priority_actions : unexpected();
  const priorityActions = [];

  for (const item of suppliedActions) {
    const phc = looseName(optionalText(item?.phc, 300), knownPhcs);
    if (!phc) {
      continue;
    }
    const medicineText = optionalText(item?.medicine, 300);
    const medicine = medicineText ? looseName(medicineText, knownMedicines) : '';
    if (medicineText && !medicine) {
      continue;
    }
    let priority;
    let reason;
    let recommendedAction;
    try {
      priority = enumValue(item?.priority, PRIORITIES);
      reason = requiredText(item?.reason);
      recommendedAction = requiredText(item?.recommended_action);
    } catch {
      continue;
    }
    priorityActions.push({
      priority,
      phc,
      medicine,
      reason,
      recommended_action: recommendedAction,
    });
  }

  if (forecastHasUrgentRisk(forecastData) && priorityActions.length === 0) {
    unexpected();
  }

  return {
    overall_risk: enumValue(value.overall_risk, RISK_LEVELS),
    summary: requiredText(value.summary),
    priority_actions: priorityActions,
  };
}

function validateEmergencyAnalysis(value, simulationData) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    unexpected();
  }

  const knownPhcs = collectForecastNames(simulationData, ['phc_name', 'phc', 'source_phc', 'destination_phc']);
  const suppliedActions = Array.isArray(value.priority_actions) ? value.priority_actions : unexpected();
  const priorityActions = [];

  for (const item of suppliedActions) {
    const phc = looseName(optionalText(item?.phc, 300), knownPhcs);
    if (!phc) {
      continue;
    }
    let priority;
    let reason;
    let recommendedAction;
    try {
      priority = enumValue(item?.priority, PRIORITIES);
      reason = requiredText(item?.reason);
      recommendedAction = requiredText(item?.recommended_action);
    } catch {
      continue;
    }
    priorityActions.push({
      priority,
      phc,
      reason,
      recommended_action: recommendedAction,
    });
  }

  const urgentSimulation = forecastHasUrgentRisk(simulationData) || simulationData.some((item) => {
    const emergencyStatus = typeof item?.emergency_status === 'string' ? item.emergency_status.trim().toUpperCase() : '';
    const medicineRisk = typeof item?.medicine_risk === 'string' ? item.medicine_risk.trim().toUpperCase() : '';
    return emergencyStatus === 'CRITICAL' || emergencyStatus === 'HIGH' || medicineRisk === 'CRITICAL' || medicineRisk === 'HIGH';
  });
  if (urgentSimulation && priorityActions.length === 0) {
    unexpected();
  }

  return {
    overall_risk: enumValue(value.overall_risk, RISK_LEVELS),
    summary: requiredText(value.summary),
    priority_actions: priorityActions,
  };
}

export {
  validateRiskAnalysis,
  validateRedistribution,
  validateQueryAnswer,
  validateForecastAnalysis,
  validateEmergencyAnalysis,
};
