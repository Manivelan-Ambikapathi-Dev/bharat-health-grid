import { Router } from 'express';
import { getPersonnel } from '../controllers/personnelController.js';

const personnelRouter = Router();

personnelRouter.get('/', getPersonnel);

export { personnelRouter };
