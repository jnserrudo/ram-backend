import { Router } from 'express';
import { login, me, register } from '../controllers/auth.controller.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.post('/login', login);
router.get('/me', authMiddleware, me);
router.post('/register', register);

export default router;
