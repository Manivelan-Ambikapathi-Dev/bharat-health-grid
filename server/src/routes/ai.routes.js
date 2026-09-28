import { Router } from 'express';
import {
  postEmergencyAnalysis,
  postForecastAnalysis,
  postOperationalQuery,
  postRedistributionRecommendations,
  postResourceRiskAnalysis,
} from '../controllers/aiController.js';
import { ROLES } from '../constants/roles.js';
import { requireRole } from '../middleware/rbacMiddleware.js';

const aiRouter = Router();

aiRouter.post('/resource-risk-analysis', postResourceRiskAnalysis);
aiRouter.post('/redistribution-recommendations', postRedistributionRecommendations);
aiRouter.post('/query', postOperationalQuery);
aiRouter.post('/forecast-analysis', postForecastAnalysis);
aiRouter.post('/emergency-analysis', requireRole(ROLES.NATIONAL_ADMIN), postEmergencyAnalysis);

export { aiRouter };
