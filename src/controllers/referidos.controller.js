import { prisma } from '../config/prisma.js';

export const obtenerReferidosUsuario = async (req, res) => {
  try {
    const { id } = req.params;
    const referidos = await prisma.referido.findMany({
      where: { usuarioId: parseInt(id) },
      orderBy: { fechaRegistro: 'desc' }
    });
    res.json(referidos);
  } catch (error) {
    console.error('Error obteniendo referidos:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
};
