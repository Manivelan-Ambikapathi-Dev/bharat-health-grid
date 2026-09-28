import { Router } from 'express';
import { postEmergencySimulation } from '../controllers/emergencyController.js';
import { ROLES } from '../constants/roles.js';
import { requireRole } from '../middleware/rbacMiddleware.js';

const emergencyRouter = Router();

emergencyRouter.post('/emergency-simulation', requireRole(ROLES.NATIONAL_ADMIN), postEmergencySimulation);

export { emergencyRouter };
