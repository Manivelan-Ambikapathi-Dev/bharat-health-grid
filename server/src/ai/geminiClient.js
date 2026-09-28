import { createHttpError } from '../utils/http.js';

const DEFAULT_MODEL = 'gemini-3.1-flash-lite';
const REQUEST_TIMEOUT_MS = 90_000;
const RETRYABLE_STATUS = new Set([429, 503]);
const MAX_ATTEMPTS = 3;

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function geminiApiKey() {
  const value = process.env.GEMINI_API_KEY;
  if (typeof value !== 'string' || value.trim() === '') {
    return '';
  }
  return value.trim();
}

function geminiModel() {
  const configured = process.env.GEMINI_MODEL;
  if (typeof configured === 'string' && configured.trim() !== '') {
    return configured.trim();
  }
  return DEFAULT_MODEL;
}

function sanitizeProviderText(text) {
  const key = geminiApiKey();
  let sanitized = String(text || '');
  if (key) {
    sanitized = sanitized.replaceAll(key, '[redacted]');
  }
  return sanitized.slice(0, 500);
}

function extractResponseText(payload) {
  const candidate = payload?.candidates?.[0];
  if (!candidate) {
    const blockReason = payload?.promptFeedback?.blockReason;
    if (blockReason) {
      throw createHttpError(502, 'The AI service declined the request.');
    }
    throw createHttpError(502, 'The AI service returned an unexpected response.');
  }

  if (candidate.finishReason && !['STOP', 'MAX_TOKENS'].includes(candidate.finishReason) && candidate.finishReason !== 'FINISH_REASON_UNSPECIFIED') {
    throw createHttpError(502, 'The AI service returned an unexpected response.');
  }

  const parts = candidate.content?.parts || [];
  const text = parts
    .filter((part) => part && part.thought !== true && typeof part.text === 'string')
    .map((part) => part.text)
    .join('')
    .trim();

  if (!text) {
    throw createHttpError(502, 'The AI service returned an unexpected response.');
  }

  return text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '');
}

async function generateStructuredJson({ systemInstruction, userPrompt, responseSchema }) {
  const apiKey = geminiApiKey();
  if (!apiKey) {
    throw createHttpError(503, 'Gemini is not configured. Set GEMINI_API_KEY.');
  }

  const model = geminiModel();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const requestBody = JSON.stringify({
    systemInstruction: {
      parts: [{ text: systemInstruction }],
    },
    contents: [
      {
        role: 'user',
        parts: [{ text: userPrompt }],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema,
      maxOutputTokens: 8192,
      thinkingConfig: {
        thinkingLevel: 'low',
      },
    },
  });

  let response;
  let rawBody = '';
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: requestBody,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
        throw createHttpError(504, 'The AI request timed out. Try again.');
      }
      console.error('Gemini request failed before a response.');
      throw createHttpError(502, 'The AI service is unavailable.');
    }

    rawBody = await response.text();
    if (response.ok) {
      break;
    }

    console.error(`Gemini request failed with status ${response.status}: ${sanitizeProviderText(rawBody)}`);
    const retryMatch = rawBody.match(/retry in ([0-9.]+)s/i);
    const retrySeconds = retryMatch ? Number(retryMatch[1]) : null;
    const shortRetry = Number.isFinite(retrySeconds) && retrySeconds > 0 && retrySeconds <= 20;
    if (response.status === 503 && attempt < MAX_ATTEMPTS) {
      await delay(1000 * attempt);
      continue;
    }
    if (shortRetry && attempt < MAX_ATTEMPTS) {
      await delay(Math.ceil(retrySeconds * 1000));
      continue;
    }

    const lowered = rawBody.toLowerCase();
    if (response.status === 401 || response.status === 403 || lowered.includes('api key') || lowered.includes('unauthenticated')) {
      throw createHttpError(502, 'The AI service rejected the API key.');
    }
    if (response.status === 429) {
      throw createHttpError(503, 'Gemini free-tier quota for this model is used up. Try again later.');
    }
    if (RETRYABLE_STATUS.has(response.status)) {
      throw createHttpError(503, 'The AI service is busy. Try again.');
    }
    throw createHttpError(502, 'The AI service is unavailable.');
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    throw createHttpError(502, 'The AI service returned an unexpected response.');
  }

  let parsed;
  try {
    parsed = JSON.parse(extractResponseText(payload));
  } catch (error) {
    if (error?.statusCode) {
      throw error;
    }
    throw createHttpError(502, 'The AI service returned an unexpected response.');
  }

  return parsed;
}

export { generateStructuredJson, geminiModel, DEFAULT_MODEL };
