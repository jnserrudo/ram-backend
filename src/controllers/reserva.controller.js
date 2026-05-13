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

    // 1. Obtener toda la info necesaria en una sola consulta
    const [usuario, horario, existente, ocupacion] = await Promise.all([
      prisma.usuario.findUnique({ where: { id: usuarioId } }),
      prisma.horario.findUnique({ where: { id: parseInt(horarioId) }, include: { tipoClase: true } }),
      prisma.reserva.findFirst({
        where: { usuarioId, horarioId: parseInt(horarioId), fecha: new Date(fecha), estado: 'RESERVADA' }
      }),
      prisma.reserva.count({
        where: { horarioId: parseInt(horarioId), fecha: new Date(fecha), estado: { in: ['RESERVADA', 'ASISTIO'] } }
      })
    ]);

    if (!usuario || usuario.creditos < 1) {
      return res.status(400).json({ error: 'Créditos insuficientes' });
    }
    if (!horario || !horario.activo) {
      return res.status(400).json({ error: 'Turno no disponible' });
    }
    if (existente) {
      return res.status(400).json({ error: 'Ya tenés una reserva' });
    }
    if (ocupacion >= horario.cupoMaximo) {
      return res.status(400).json({ error: 'Cupo completo' });
    }

    const fechaObj = new Date(fecha);
    fechaObj.setHours(0, 0, 0, 0);

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    if (fechaObj < hoy) {
      return res.status(400).json({ error: 'No podés reservar turnos de días que ya pasaron' });
    }

    // 2. Transacción atómica
    const [reserva] = await prisma.$transaction([
      prisma.reserva.create({
        data: { usuarioId, horarioId: parseInt(horarioId), fecha: fechaObj }
      }),
      prisma.usuario.update({
        where: { id: usuarioId },
        data: { creditos: { decrement: 1 } }
      })
    ]);

    // Enviar WhatsApp en background (no bloquea el response)
    const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    enviarWhatsApp({
      usuarioId,
      telefono: usuario.celular,
      tipo: 'RESERVA',
      mensaje: `Reserva confirmada: ${horario.tipoClase.titulo} - ${dias[fechaObj.getDay()]} ${fechaObj.getDate()} a las ${horario.horaInicio}:00. Te quedan ${usuario.creditos - 1} clases.`
    }).catch(e => console.error('Error enviando WhatsApp diferido:', e));

    res.status(201).json({ message: 'Reserva confirmada', reserva });
  } catch (error) {
    console.error('Reserva error:', error);
    res.status(500).json({ error: 'Error interno al procesar la reserva' });
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

    // Ejecutar en transacción
    await prisma.$transaction([
      prisma.reserva.update({
        where: { id: parseInt(id) },
        data: { estado: 'CANCELADA' }
      }),
      prisma.usuario.update({
        where: { id: usuarioId },
        data: { creditos: { increment: 1 } }
      })
    ]);

    res.json({ message: 'Reserva cancelada. Se te reembolsó 1 crédito.' });
  } catch (error) {
    console.error('Cancelación error:', error);
    res.status(500).json({ error: 'Error interno al cancelar la reserva' });
  }
};
