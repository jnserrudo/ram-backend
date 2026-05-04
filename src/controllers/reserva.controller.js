import { prisma } from '../config/prisma.js';
import { enviarWhatsApp } from '../config/whatsapp.js';

export const misReservas = async (req, res) => {
  try {
    const ahora = new Date();
    const reservas = await prisma.reserva.findMany({
      where: { usuarioId: req.user.id },
      include: { horario: { include: { tipoClase: true } } },
      orderBy: { fecha: 'desc' }
    });
    res.json(reservas);
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

export const crearReserva = async (req, res) => {
  try {
    const { horarioId, fecha } = req.body;
    const usuarioId = req.user.id;

    const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId } });
    if (!usuario || usuario.creditos < 1) {
      return res.status(400).json({ error: 'No tenés créditos disponibles. Acercate a recepción para recargar.' });
    }

    const horario = await prisma.horario.findUnique({ where: { id: parseInt(horarioId) } });
    if (!horario || !horario.activo) {
      return res.status(400).json({ error: 'Turno no disponible' });
    }

    const fechaObj = new Date(fecha);
    fechaObj.setHours(0, 0, 0, 0);

    // Verificar no duplicada
    const existente = await prisma.reserva.findFirst({
      where: { usuarioId, horarioId: parseInt(horarioId), fecha: fechaObj, estado: 'RESERVADA' }
    });
    if (existente) {
      return res.status(400).json({ error: 'Ya tenés una reserva para este turno' });
    }

    // Verificar cupo
    const reservasCount = await prisma.reserva.count({
      where: { horarioId: parseInt(horarioId), fecha: fechaObj, estado: { in: ['RESERVADA', 'ASISTIO'] } }
    });
    const asistenciasCount = await prisma.asistencia.count({
      where: { horarioId: parseInt(horarioId), fecha: fechaObj }
    });
    if (reservasCount + asistenciasCount >= horario.cupoMaximo) {
      return res.status(400).json({ error: 'Este turno ya no tiene cupos disponibles' });
    }

    const reserva = await prisma.reserva.create({
      data: {
        usuarioId,
        horarioId: parseInt(horarioId),
        fecha: fechaObj
      }
    });

    await prisma.usuario.update({
      where: { id: usuarioId },
      data: { creditos: usuario.creditos - 1 }
    });

    const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    await enviarWhatsApp({
      usuarioId,
      telefono: usuario.celular,
      tipo: 'RESERVA',
      mensaje: `Reserva confirmada: ${horario.tipoClase.titulo} - ${dias[fechaObj.getDay()]} ${fechaObj.getDate()} a las ${horario.horaInicio}:00. Te quedan ${usuario.creditos - 1} clases.`
    });

    res.status(201).json({ message: 'Reserva confirmada', reserva });
  } catch (error) {
    console.error('Reserva error:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
};

export const cancelarReserva = async (req, res) => {
  try {
    const { id } = req.params;
    const usuarioId = req.user.id;

    const reserva = await prisma.reserva.findFirst({
      where: { id: parseInt(id), usuarioId }
    });
    if (!reserva) return res.status(404).json({ error: 'Reserva no encontrada' });
    if (reserva.estado !== 'RESERVADA') {
      return res.status(400).json({ error: 'No se puede cancelar esta reserva' });
    }

    await prisma.reserva.update({
      where: { id: parseInt(id) },
      data: { estado: 'CANCELADA' }
    });

    await prisma.usuario.update({
      where: { id: usuarioId },
      data: { creditos: { increment: 1 } }
    });

    res.json({ message: 'Reserva cancelada. Se te reembolsó 1 crédito.' });
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};
