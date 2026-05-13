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
        where: { usuarioId, horarioId: parseInt(horarioId), fecha: new Date(fecha), estado: { in: ['RESERVADA', 'EN_ESPERA'] } }
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
      return res.status(400).json({ error: 'Ya tenés una reserva o estás en espera para este turno' });
    }

    const fechaObj = new Date(fecha);
    fechaObj.setHours(0, 0, 0, 0);

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    if (fechaObj < hoy) {
      return res.status(400).json({ error: 'No podés reservar turnos de días que ya pasaron' });
    }

    // Determinar estado inicial
    const esEspera = ocupacion >= horario.cupoMaximo;
    const estadoInicial = esEspera ? 'EN_ESPERA' : 'RESERVADA';

    // 2. Transacción atómica
    const [reserva] = await prisma.$transaction([
      prisma.reserva.create({
        data: { usuarioId, horarioId: parseInt(horarioId), fecha: fechaObj, estado: estadoInicial }
      }),
      prisma.usuario.update({
        where: { id: usuarioId },
        data: { creditos: { decrement: 1 } }
      })
    ]);

    // Enviar WhatsApp en background
    const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const mensaje = esEspera 
      ? `Lista de espera confirmada: ${horario.tipoClase.titulo} - ${dias[fechaObj.getDay()]} ${fechaObj.getDate()}. Te avisaremos si se libera un cupo.`
      : `Reserva confirmada: ${horario.tipoClase.titulo} - ${dias[fechaObj.getDay()]} ${fechaObj.getDate()} a las ${horario.horaInicio}:00. Te quedan ${usuario.creditos - 1} clases.`;

    enviarWhatsApp({
      usuarioId,
      telefono: usuario.celular,
      tipo: 'RESERVA',
      mensaje
    }).catch(e => console.error('Error enviando WhatsApp diferido:', e));

    res.status(201).json({ 
      message: esEspera ? 'Te anotaste en la lista de espera' : 'Reserva confirmada', 
      reserva,
      esEspera 
    });
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
      where: { id: parseInt(id), usuarioId },
      include: { horario: { include: { tipoClase: true } } }
    });

    if (!reserva) return res.status(404).json({ error: 'Reserva no encontrada' });
    if (reserva.estado !== 'RESERVADA' && reserva.estado !== 'EN_ESPERA') {
      return res.status(400).json({ error: 'No se puede cancelar esta reserva' });
    }

    const fueConfirmada = reserva.estado === 'RESERVADA';

    // 1. Cancelar la reserva actual y devolver crédito
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

    // 2. Si la reserva cancelada estaba CONFIRMADA, buscar a alguien en lista de espera
    if (fueConfirmada) {
      const proximoEnEspera = await prisma.reserva.findFirst({
        where: { 
          horarioId: reserva.horarioId, 
          fecha: reserva.fecha, 
          estado: 'EN_ESPERA' 
        },
        orderBy: { createdAt: 'asc' }, // El primero que se anotó
        include: { usuario: true }
      });

      if (proximoEnEspera) {
        // Promocionar a confirmado
        await prisma.reserva.update({
          where: { id: proximoEnEspera.id },
          data: { estado: 'RESERVADA' }
        });

        // Avisar por WhatsApp
        const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        enviarWhatsApp({
          usuarioId: proximoEnEspera.usuarioId,
          telefono: proximoEnEspera.usuario.celular,
          tipo: 'RESERVA',
          mensaje: `¡Buenas noticias! Se liberó un cupo y tu reserva para ${reserva.horario.tipoClase.titulo} el ${dias[reserva.fecha.getDay()]} ${reserva.fecha.getDate()} a las ${reserva.horario.horaInicio}:00 ha sido CONFIRMADA.`
        }).catch(e => console.error('Error avisando promoción:', e));
      }
    }

    res.json({ message: 'Reserva cancelada. Se te reembolsó 1 crédito.' });
  } catch (error) {
    console.error('Cancelación error:', error);
    res.status(500).json({ error: 'Error interno al cancelar la reserva' });
  }
};
