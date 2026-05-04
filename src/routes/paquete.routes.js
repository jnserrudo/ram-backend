import { Router } from 'express';
import { listarPaquetes, listarTodosPaquetes, crearPaquete, actualizarPaquete, eliminarPaquete } from '../controllers/paquete.controller.js';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';

const router = Router();

router.get('/', authMiddleware, listarPaquetes);
router.get('/admin', authMiddleware, adminMiddleware, listarTodosPaquetes);
router.post('/', authMiddleware, adminMiddleware, crearPaquete);
router.put('/:id', authMiddleware, adminMiddleware, actualizarPaquete);
router.delete('/:id', authMiddleware, adminMiddleware, eliminarPaquete);

export default router;
