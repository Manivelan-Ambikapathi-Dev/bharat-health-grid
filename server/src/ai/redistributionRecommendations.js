import { createHttpError } from '../utils/http.js';
import { generateStructuredJson } from './geminiClient.js';
import { loadOperationalContext } from './operationalContext.js';
import { buildRedistributionPrompt, redistributionSchema, redistributionSystemInstruction } from './prompts/redistributionPrompt.js';
import { validateRedistribution } from './validateAiResponse.js';

async function recommendRedistribution(access) {
  const context = await loadOperationalContext(access);
  if (!context) {
    throw createHttpError(404, 'No operational data is available for analysis.');
  }

  if (context.redistributionPairs.length === 0) {
    return {
      transfers_executed: false,
      recommendations: [],
      warning: 'No excess stock could be matched to a shortage of the same medicine.',
    };
  }

  const generated = await generateStructuredJson({
    systemInstruction: redistributionSystemInstruction,
    userPrompt: buildRedistributionPrompt(context),
    responseSchema: redistributionSchema,
  });

  return {
    transfers_executed: false,
    recommendations: validateRedistribution(generated, context.redistributionPairs),
  };
}

export { recommendRedistribution };
