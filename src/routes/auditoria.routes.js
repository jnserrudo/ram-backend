import { Router } from 'express';
import { listarAuditoria, detalleAuditoria, estadisticasAuditoria } from '../controllers/auditoria.controller.js';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';

const router = Router();

router.get('/', authMiddleware, adminMiddleware, listarAuditoria);
router.get('/estadisticas', authMiddleware, adminMiddleware, estadisticasAuditoria);
router.get('/:id', authMiddleware, adminMiddleware, detalleAuditoria);

export default router;
