import { Router } from 'express';
import { getPhcSummaryHandler, getStateSummaryHandler } from '../controllers/analyticsController.js';
import { ROLES } from '../constants/roles.js';
import { requireRole } from '../middleware/rbacMiddleware.js';
import { requirePhcScope } from '../middleware/scopeMiddleware.js';

const analyticsRouter = Router();

analyticsRouter.get(
  '/state-summary',
  requireRole(ROLES.NATIONAL_ADMIN, ROLES.STATE_ADMIN),
  getStateSummaryHandler,
);
analyticsRouter.get('/phc-summary/:phcId', requirePhcScope, getPhcSummaryHandler);

export { analyticsRouter };
