import { Router } from 'express';
import { listarComunicados, crearComunicado, actualizarComunicado, eliminarComunicado } from '../controllers/comunicado.controller.js';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';

const router = Router();

router.get('/', listarComunicados);
router.post('/', authMiddleware, adminMiddleware, crearComunicado);
router.put('/:id', authMiddleware, adminMiddleware, actualizarComunicado);
router.delete('/:id', authMiddleware, adminMiddleware, eliminarComunicado);

export default router;
