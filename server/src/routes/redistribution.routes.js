import { Router } from 'express';
import { postRedistributionApproval } from '../controllers/redistributionApprovalController.js';

const redistributionRouter = Router();

redistributionRouter.post('/approve', postRedistributionApproval);

export { redistributionRouter };
