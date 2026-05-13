import { Router } from 'express';
import { obtenerMetricas, obtenerInscriptosSemana, obtenerHistoricoInscriptos } from '../controllers/dashboard.controller.js';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';

const router = Router();

router.get('/metricas', authMiddleware, adminMiddleware, obtenerMetricas);
router.get('/inscriptos-semana', authMiddleware, adminMiddleware, obtenerInscriptosSemana);
router.get('/historico-inscriptos', authMiddleware, adminMiddleware, obtenerHistoricoInscriptos);

export default router;
