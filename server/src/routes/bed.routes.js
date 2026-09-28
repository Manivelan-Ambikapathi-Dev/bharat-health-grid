import { Router } from 'express';
import { getBeds } from '../controllers/bedController.js';

const bedRouter = Router();

bedRouter.get('/', getBeds);

export { bedRouter };
