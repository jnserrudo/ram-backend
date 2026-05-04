import { prisma } from '../config/prisma.js';

export const obtenerLogrosUsuario = async (req, res) => {
  try {
    const { id } = req.params;
    const logros = await prisma.logro.findMany({
      where: { usuarioId: parseInt(id) },
      orderBy: { fechaObtenido: 'desc' }
    });
    res.json(logros);
  } catch (error) {
    console.error('Error obteniendo logros:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
};

export const obtenerRanking = async (req, res) => {
  try {
    const mesActual = new Date();
    mesActual.setDate(1);
    mesActual.setHours(0, 0, 0, 0);

    const usuarios = await prisma.usuario.findMany({
      where: {
        activo: true,
        rol: 'USER'
      },
      select: {
        id: true,
        nombre: true,
        apellido: true,
        _count: {
          select: {
            asistencias: {
              where: {
                fecha: { gte: mesActual }
              }
            }
          }
        }
      }
    });

    const ranking = usuarios
      .map(u => ({
        id: u.id,
        nombre: `${u.nombre} ${u.apellido}`,
        asistencias: u._count.asistencias
      }))
      .filter(u => u.asistencias > 0)
      .sort((a, b) => b.asistencias - a.asistencias)
      .slice(0, 10);

    res.json(ranking);
  } catch (error) {
    console.error('Error obteniendo ranking:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
};
