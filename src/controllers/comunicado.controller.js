import { prisma } from '../config/prisma.js';

export const listarComunicados = async (req, res) => {
  try {
    const ahora = new Date();
    const comunicados = await prisma.comunicado.findMany({
      where: {
        activo: true,
        OR: [
          { fechaExpiracion: null },
          { fechaExpiracion: { gte: ahora } }
        ]
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(comunicados);
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

export const crearComunicado = async (req, res) => {
  try {
    const { titulo, mensaje, fechaExpiracion } = req.body;
    const comunicado = await prisma.comunicado.create({
      data: {
        adminId: req.user.id,
        titulo,
        mensaje,
        fechaExpiracion: fechaExpiracion ? new Date(fechaExpiracion) : null
      }
    });
    res.status(201).json(comunicado);
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

export const actualizarComunicado = async (req, res) => {
  try {
    const { id } = req.params;
    const { titulo, mensaje, activo, fechaExpiracion } = req.body;
    const comunicado = await prisma.comunicado.update({
      where: { id: parseInt(id) },
      data: { titulo, mensaje, activo, fechaExpiracion: fechaExpiracion ? new Date(fechaExpiracion) : undefined }
    });
    res.json(comunicado);
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

export const eliminarComunicado = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.comunicado.update({
      where: { id: parseInt(id) },
      data: { activo: false }
    });
    res.json({ message: 'Comunicado desactivado' });
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};
