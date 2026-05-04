import express from 'express';
import { obtenerPlanUsuario, crearPlan } from '../controllers/planes.controller.js';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';

const router = express.Router();

router.get('/usuario/:id', authMiddleware, obtenerPlanUsuario);
router.post('/', authMiddleware, adminMiddleware, crearPlan);

export default router;
