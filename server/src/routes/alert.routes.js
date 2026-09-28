import { Router } from 'express';
import { getAlerts } from '../controllers/alertController.js';

const alertRouter = Router();

alertRouter.get('/', getAlerts);

export { alertRouter };
