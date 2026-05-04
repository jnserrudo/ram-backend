import { Router } from 'express';
import { listarAsistencias, misAsistencias } from '../controllers/asistencia.controller.js';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';

const router = Router();

router.get('/', authMiddleware, adminMiddleware, listarAsistencias);
router.get('/mias', authMiddleware, misAsistencias);

export default router;
