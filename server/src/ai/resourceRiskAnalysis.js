import { createHttpError } from '../utils/http.js';
import { generateStructuredJson } from './geminiClient.js';
import { loadOperationalContext } from './operationalContext.js';
import { buildResourceRiskPrompt, resourceRiskSchema, resourceRiskSystemInstruction } from './prompts/resourceRiskPrompt.js';
import { validateRiskAnalysis } from './validateAiResponse.js';

async function analyzeResourceRisk(access) {
  const context = await loadOperationalContext(access);
  if (!context) {
    throw createHttpError(404, 'No operational data is available for analysis.');
  }

  const generated = await generateStructuredJson({
    systemInstruction: resourceRiskSystemInstruction,
    userPrompt: buildResourceRiskPrompt(context),
    responseSchema: resourceRiskSchema,
  });

  return validateRiskAnalysis(generated, context);
}

export { analyzeResourceRisk };
