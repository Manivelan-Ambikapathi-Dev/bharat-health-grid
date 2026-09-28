import { ROLES } from '../constants/roles.js';
import { findPhcByName, assertPlace } from '../middleware/scopeMiddleware.js';
import { createHttpError, textQuery } from '../utils/http.js';
import { FORBIDDEN_MESSAGE } from '../middleware/rbacMiddleware.js';

async function postRedistributionApproval(req, res) {
  if (!req.user || req.user.role === ROLES.PHC_STAFF) {
    throw createHttpError(403, FORBIDDEN_MESSAGE);
  }

  const medicine = textQuery(req.body?.medicine);
  const sourceName = textQuery(req.body?.source_phc);
  const destinationName = textQuery(req.body?.destination_phc);
  if (!medicine || !sourceName || !destinationName) {
    throw createHttpError(400, 'medicine, source_phc, and destination_phc are required');
  }

  const source = await findPhcByName(sourceName);
  const destination = await findPhcByName(destinationName);
  if (!source || !destination) {
    throw createHttpError(404, 'PHC not found');
  }

  if (req.user.role === ROLES.DISTRICT_OFFICER && source.district_id !== destination.district_id) {
    throw createHttpError(403, FORBIDDEN_MESSAGE);
  }

  assertPlace(req.user, source);
  assertPlace(req.user, destination);

  res.json({
    success: true,
    data: {
      medicine,
      source_phc: source.name,
      destination_phc: destination.name,
      status: 'Approved — awaiting execution',
      transfers_executed: false,
      database_modified: false,
    },
  });
}

export { postRedistributionApproval };
