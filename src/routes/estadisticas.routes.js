import express from 'express';
import { obtenerEstadisticasUsuario } from '../controllers/estadisticas.controller.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

router.get('/usuario/:id', authMiddleware, obtenerEstadisticasUsuario);

export default router;
