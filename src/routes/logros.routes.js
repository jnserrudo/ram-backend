import express from 'express';
import { obtenerLogrosUsuario, obtenerRanking } from '../controllers/logros.controller.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

router.get('/usuario/:id', authMiddleware, obtenerLogrosUsuario);
router.get('/ranking', authMiddleware, obtenerRanking);

export default router;
