import express from 'express';
import { registrarActividad, obtenerActividadesUsuario } from '../controllers/actividad.controller.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

router.post('/', authMiddleware, registrarActividad);
router.get('/usuario/:id', authMiddleware, obtenerActividadesUsuario);

export default router;
