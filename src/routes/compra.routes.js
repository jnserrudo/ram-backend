import { Router } from 'express';
import { registrarCompra, listarCompras, misCompras } from '../controllers/compra.controller.js';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';

const router = Router();

router.get('/', authMiddleware, adminMiddleware, listarCompras);
router.get('/mias', authMiddleware, misCompras);
router.post('/', authMiddleware, adminMiddleware, registrarCompra);

export default router;
