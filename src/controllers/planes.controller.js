import { prisma } from '../config/prisma.js';

export const obtenerPlanUsuario = async (req, res) => {
  try {
    const { id } = req.params;
    const plan = await prisma.planEntrenamiento.findFirst({
      where: { usuarioId: parseInt(id), activo: true },
      include: { ejercicios: { orderBy: [{ diaSemana: 'asc' }, { orden: 'asc' }] } }
    });
    res.json(plan);
  } catch (error) {
    console.error('Error obteniendo plan:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
};

export const crearPlan = async (req, res) => {
  try {
    const { usuarioId, titulo, objetivo, nivel, ejercicios } = req.body;
    
    await prisma.planEntrenamiento.updateMany({
      where: { usuarioId: parseInt(usuarioId), activo: true },
      data: { activo: false }
    });

    const plan = await prisma.planEntrenamiento.create({
      data: {
        usuarioId: parseInt(usuarioId),
        titulo,
        objetivo,
        nivel,
        ejercicios: {
          create: ejercicios
        }
      },
      include: { ejercicios: true }
    });

    res.status(201).json(plan);
  } catch (error) {
    console.error('Error creando plan:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
};
