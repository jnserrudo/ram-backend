import { prisma } from '../config/prisma.js';

export const listarAsistencias = async (req, res) => {
  try {
    const asistencias = await prisma.asistencia.findMany({
      include: {
        usuario: { select: { id: true, nombre: true, apellido: true, dni: true } },
        horario: { include: { tipoClase: true } }
      },
      orderBy: { fecha: 'desc' }
    });
    res.json(asistencias);
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

export const misAsistencias = async (req, res) => {
  try {
    const asistencias = await prisma.asistencia.findMany({
      where: { usuarioId: req.user.id },
      include: { horario: { include: { tipoClase: true } } },
      orderBy: { fecha: 'desc' }
    });
    res.json(asistencias);
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};
