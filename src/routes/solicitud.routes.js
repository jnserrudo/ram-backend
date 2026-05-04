import { Router } from 'express';
import { listarSolicitudes, aprobarSolicitud } from '../controllers/solicitud.controller.js';
import { register } from '../controllers/auth.controller.js';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';

const router = Router();

router.post('/', register);
router.get('/', authMiddleware, adminMiddleware, listarSolicitudes);
router.put('/:id/aprobar', authMiddleware, adminMiddleware, aprobarSolicitud);

export default router;
