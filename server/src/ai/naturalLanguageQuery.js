import { createHttpError } from '../utils/http.js';
import { generateStructuredJson } from './geminiClient.js';
import { loadOperationalContext, withQueryView } from './operationalContext.js';
import { buildQueryPrompt, querySchema, querySystemInstruction } from './prompts/queryPrompt.js';
import { validateQueryAnswer } from './validateAiResponse.js';

async function answerOperationalQuestion(question, access) {
  const loaded = await loadOperationalContext(access);
  if (!loaded) {
    throw createHttpError(404, 'No operational data is available for analysis.');
  }

  const context = withQueryView(loaded);
  const generated = await generateStructuredJson({
    systemInstruction: querySystemInstruction,
    userPrompt: buildQueryPrompt(context, question),
    responseSchema: querySchema,
  });

  return validateQueryAnswer(generated, context);
}

export { answerOperationalQuestion };
