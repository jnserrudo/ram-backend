import { prisma } from '../config/prisma.js';

export const misNotificaciones = async (req, res) => {
  try {
    const notificaciones = await prisma.notificacion.findMany({
      where: { usuarioId: req.user.id },
      orderBy: { createdAt: 'desc' }
    });
    res.json(notificaciones);
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

export const marcarLeida = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.notificacion.update({
      where: { id: parseInt(id), usuarioId: req.user.id },
      data: { leida: true }
    });
    res.json({ message: 'Notificación marcada como leída' });
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

export const marcarTodasLeidas = async (req, res) => {
  try {
    await prisma.notificacion.updateMany({
      where: { usuarioId: req.user.id, leida: false },
      data: { leida: true }
    });
    res.json({ message: 'Todas las notificaciones marcadas como leídas' });
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

export const noLeidas = async (req, res) => {
  try {
    const count = await prisma.notificacion.count({
      where: { usuarioId: req.user.id, leida: false }
    });
    res.json({ count });
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

export async function crearNotificacion({ usuarioId, tipo, titulo, mensaje, urlOpcional }) {
  try {
    await prisma.notificacion.create({
      data: { usuarioId, tipo, titulo, mensaje, urlOpcional }
    });
  } catch (error) {
    console.error('Error creando notificación:', error.message);
  }
}
