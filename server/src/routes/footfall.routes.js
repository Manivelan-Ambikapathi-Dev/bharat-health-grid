import { Router } from 'express';
import { getFootfall } from '../controllers/footfallController.js';

const footfallRouter = Router();

footfallRouter.get('/', getFootfall);

export { footfallRouter };
