import { Router } from 'express';
import { misReservas, crearReserva, cancelarReserva } from '../controllers/reserva.controller.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.get('/mias', authMiddleware, misReservas);
router.post('/', authMiddleware, crearReserva);
router.delete('/:id', authMiddleware, cancelarReserva);

export default router;
