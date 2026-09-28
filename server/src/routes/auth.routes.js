import { Router } from 'express';
import { getMe, postLogin } from '../controllers/authController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const authRouter = Router();

authRouter.post('/login', postLogin);
authRouter.get('/me', authenticate, getMe);

export { authRouter };
