import { getPhcSummary, getStateSummary } from '../services/analyticsService.js';
import { ROLES } from '../constants/roles.js';
import { createHttpError, positiveIntQuery } from '../utils/http.js';

async function getStateSummaryHandler(req, res) {
  const data = await getStateSummary();
  const scoped = req.user?.role === ROLES.STATE_ADMIN
    ? data.filter((row) => row.state === req.user.stateName)
    : data;
  res.json({ success: true, data: scoped });
}

async function getPhcSummaryHandler(req, res) {
  const phcId = positiveIntQuery(req.params.phcId, 'phcId');
  if (!phcId) {
    throw createHttpError(400, 'phcId must be a positive integer');
  }

  const data = await getPhcSummary(phcId);
  if (!data) {
    throw createHttpError(404, 'PHC not found');
  }

  res.json({ success: true, data });
}

export { getStateSummaryHandler, getPhcSummaryHandler };
