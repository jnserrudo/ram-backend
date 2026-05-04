import { Router } from 'express';
import { misNotificaciones, marcarLeida, marcarTodasLeidas, noLeidas } from '../controllers/notificacion.controller.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.get('/', authMiddleware, misNotificaciones);
router.get('/no-leidas', authMiddleware, noLeidas);
router.put('/:id/leer', authMiddleware, marcarLeida);
router.put('/leer-todas', authMiddleware, marcarTodasLeidas);

export default router;
