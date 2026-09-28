import { analyzeResourceRisk } from '../ai/resourceRiskAnalysis.js';
import { recommendRedistribution } from '../ai/redistributionRecommendations.js';
import { answerOperationalQuestion } from '../ai/naturalLanguageQuery.js';
import { analyzeForecast } from '../ai/forecastAnalysis.js';
import { analyzeEmergency } from '../ai/emergencyAnalysis.js';
import { createHttpError } from '../utils/http.js';

async function postResourceRiskAnalysis(req, res) {
  const data = await analyzeResourceRisk(req.user);
  res.json({ success: true, data });
}

async function postRedistributionRecommendations(req, res) {
  const data = await recommendRedistribution(req.user);
  res.json({ success: true, data });
}

async function postOperationalQuery(req, res) {
  const question = req.body?.question;
  if (typeof question !== 'string' || question.trim().length < 3) {
    throw createHttpError(400, 'question is required.');
  }
  if (question.trim().length > 1000) {
    throw createHttpError(400, 'question must be 1000 characters or fewer.');
  }

  const data = await answerOperationalQuestion(question.trim(), req.user);
  res.json({ success: true, data });
}

async function postForecastAnalysis(req, res) {
  const forecastData = req.body && Object.prototype.hasOwnProperty.call(req.body, 'forecastData')
    ? req.body.forecastData
    : undefined;
  const data = await analyzeForecast(forecastData, req.user);
  res.json({ success: true, data });
}

async function postEmergencyAnalysis(req, res) {
  const data = await analyzeEmergency(req.body || {});
  res.json({ success: true, data });
}

export {
  postResourceRiskAnalysis,
  postRedistributionRecommendations,
  postOperationalQuery,
  postForecastAnalysis,
  postEmergencyAnalysis,
};
