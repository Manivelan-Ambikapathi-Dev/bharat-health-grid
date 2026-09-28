function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function textQuery(value) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== 'string') {
    return undefined;
  }
  const trimmed = raw.trim();
  return trimmed === '' ? undefined : trimmed;
}

function dateQuery(value, fieldName) {
  const text = textQuery(value);
  if (text === undefined) {
    return undefined;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw createHttpError(400, `${fieldName} must be YYYY-MM-DD`);
  }
  const parsed = new Date(`${text}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== text) {
    throw createHttpError(400, `${fieldName} must be a valid date`);
  }
  return text;
}

function positiveIntQuery(value, fieldName) {
  const text = textQuery(value);
  if (text === undefined) {
    return undefined;
  }
  if (!/^\d+$/.test(text)) {
    throw createHttpError(400, `${fieldName} must be a positive integer`);
  }
  const number = Number(text);
  if (!Number.isSafeInteger(number) || number <= 0) {
    throw createHttpError(400, `${fieldName} must be a positive integer`);
  }
  return number;
}

function toNumber(value) {
  if (value === null || value === undefined) {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export { createHttpError, textQuery, dateQuery, positiveIntQuery, toNumber };
