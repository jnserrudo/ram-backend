import { prisma } from '../config/prisma.js';

export const listarHorarios = async (req, res) => {
  try {
    const horarios = await prisma.horario.findMany({
      include: { tipoClase: true },
      orderBy: [{ diaSemana: 'asc' }, { horaInicio: 'asc' }]
    });
    res.json(horarios);
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

export const crearHorario = async (req, res) => {
  try {
    const { tipoClaseId, diaSemana, horaInicio, bloque, cupoMaximo } = req.body;
    const horario = await prisma.horario.create({
      data: { tipoClaseId: parseInt(tipoClaseId), diaSemana: parseInt(diaSemana), horaInicio: parseInt(horaInicio), bloque, cupoMaximo: parseInt(cupoMaximo) || 12 }
    });
    res.status(201).json(horario);
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

export const actualizarHorario = async (req, res) => {
  try {
    const { id } = req.params;
    const { tipoClaseId, diaSemana, horaInicio, bloque, cupoMaximo, activo } = req.body;
    const horario = await prisma.horario.update({
      where: { id: parseInt(id) },
      data: {
        tipoClaseId: tipoClaseId ? parseInt(tipoClaseId) : undefined,
        diaSemana: diaSemana !== undefined ? parseInt(diaSemana) : undefined,
        horaInicio: horaInicio !== undefined ? parseInt(horaInicio) : undefined,
        bloque: bloque || undefined,
        cupoMaximo: cupoMaximo !== undefined ? parseInt(cupoMaximo) : undefined,
        activo: activo !== undefined ? activo : undefined
      }
    });
    res.json(horario);
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

export const eliminarHorario = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.horario.update({
      where: { id: parseInt(id) },
      data: { activo: false }
    });
    res.json({ message: 'Horario desactivado' });
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

export const grillaSemanal = async (req, res) => {
  try {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const finSemana = new Date(hoy);
    finSemana.setDate(finSemana.getDate() + 7);

    const horarios = await prisma.horario.findMany({
      where: { activo: true },
      include: { tipoClase: true },
      orderBy: [{ diaSemana: 'asc' }, { horaInicio: 'asc' }]
    });

    const reservas = await prisma.reserva.findMany({
      where: {
        fecha: { gte: hoy, lt: finSemana },
        estado: { in: ['RESERVADA', 'ASISTIO'] }
      }
    });

    const asistencias = await prisma.asistencia.findMany({
      where: { fecha: { gte: hoy, lt: finSemana } }
    });

    const resultado = horarios.map(h => {
      const reservasCount = reservas.filter(r => r.horarioId === h.id).length;
      const asistenciasCount = asistencias.filter(a => a.horarioId === h.id).length;
      const ocupado = reservasCount + asistenciasCount;
      return {
        ...h,
        cupoOcupado: ocupado,
        cupoDisponible: Math.max(0, h.cupoMaximo - ocupado)
      };
    });

    res.json(resultado);
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};
