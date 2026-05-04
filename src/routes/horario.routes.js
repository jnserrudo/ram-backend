import { Router } from 'express';
import { listarHorarios, crearHorario, actualizarHorario, eliminarHorario, grillaSemanal } from '../controllers/horario.controller.js';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';

const router = Router();

router.get('/', authMiddleware, listarHorarios);
router.get('/semana', authMiddleware, grillaSemanal);
router.post('/', authMiddleware, adminMiddleware, crearHorario);
router.put('/:id', authMiddleware, adminMiddleware, actualizarHorario);
router.delete('/:id', authMiddleware, adminMiddleware, eliminarHorario);

export default router;
