import express from 'express';
import { obtenerReferidosUsuario } from '../controllers/referidos.controller.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

router.get('/usuario/:id', authMiddleware, obtenerReferidosUsuario);

export default router;
