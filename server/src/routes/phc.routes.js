import { Router } from 'express';
import { getPhcs } from '../controllers/phcController.js';

const phcRouter = Router();

phcRouter.get('/', getPhcs);

export { phcRouter };
