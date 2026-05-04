import { Router } from 'express';
import { listarClases, crearClase, actualizarClase, eliminarClase } from '../controllers/clase.controller.js';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';

const router = Router();

router.get('/', authMiddleware, listarClases);
router.post('/', authMiddleware, adminMiddleware, crearClase);
router.put('/:id', authMiddleware, adminMiddleware, actualizarClase);
router.delete('/:id', authMiddleware, adminMiddleware, eliminarClase);

export default router;
