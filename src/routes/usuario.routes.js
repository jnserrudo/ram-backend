import { Router } from 'express';
import { listarUsuarios, actualizarCreditos, actualizarPerfil, cambiarPassword, crearUsuario, reactivarUsuario, desactivarUsuario } from '../controllers/usuario.controller.js';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';

const router = Router();

router.get('/', authMiddleware, adminMiddleware, listarUsuarios);
router.post('/', authMiddleware, adminMiddleware, crearUsuario);
router.put('/:id/creditos', authMiddleware, adminMiddleware, actualizarCreditos);
router.put('/:id/reactivar', authMiddleware, adminMiddleware, reactivarUsuario);
router.put('/:id/desactivar', authMiddleware, adminMiddleware, desactivarUsuario);
router.put('/perfil', authMiddleware, actualizarPerfil);
router.put('/password', authMiddleware, cambiarPassword);

export default router;
