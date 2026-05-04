import { Router } from 'express';
import { reporteAsistencias, reporteUsuarios, reporteFinanciero } from '../controllers/reporte.controller.js';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';

const router = Router();

router.get('/asistencias', authMiddleware, adminMiddleware, reporteAsistencias);
router.get('/usuarios', authMiddleware, adminMiddleware, reporteUsuarios);
router.get('/financiero', authMiddleware, adminMiddleware, reporteFinanciero);

export default router;
