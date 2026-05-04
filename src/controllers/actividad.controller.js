import { prisma } from '../config/prisma.js';

export const registrarActividad = async (req, res) => {
  try {
    const { usuarioId, fecha, pasos, caloriasQuemadas, frecuenciaCardiacaPromedio, duracionMinutos } = req.body;
    
    const actividad = await prisma.registroActividad.create({
      data: {
        usuarioId: parseInt(usuarioId),
        fecha: new Date(fecha),
        pasos,
        caloriasQuemadas,
        frecuenciaCardiacaPromedio,
        duracionMinutos
      }
    });

    res.status(201).json(actividad);
  } catch (error) {
    console.error('Error registrando actividad:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
};

export const obtenerActividadesUsuario = async (req, res) => {
  try {
    const { id } = req.params;
    const actividades = await prisma.registroActividad.findMany({
      where: { usuarioId: parseInt(id) },
      orderBy: { fecha: 'desc' },
      take: 30
    });
    res.json(actividades);
  } catch (error) {
    console.error('Error obteniendo actividades:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
};
