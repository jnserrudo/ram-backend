import { prisma } from '../config/prisma.js';
import { enviarWhatsApp } from '../config/whatsapp.js';
import { consumirCreditoFIFO, recalcularCreditos } from '../helpers/creditos.js';
import { verificarLogros } from '../helpers/logros.js';

export const checkin = async (req, res) => {
  try {
    const { dni } = req.body;

    const usuario = await prisma.usuario.findUnique({ where: { dni } });
    if (!usuario) {
      return res.status(404).json({
        success: false,
        error: 'No encontramos un socio con ese DNI. Verificá el número o acercate a recepción.'
      });
    }

    if (!usuario.activo) {
      return res.status(403).json({
        success: false,
        error: 'Tu cuenta está inactiva. Contactá a recepción para reactivarla y seguir entrenando.'
      });
    }

    const ahora = new Date();
    const hoy = new Date(ahora);
    hoy.setHours(0, 0, 0, 0);

    // Verificar créditos vigentes antes de continuar
    await recalcularCreditos(usuario.id);
    const usuarioActualizado = await prisma.usuario.findUnique({ where: { id: usuario.id } });

    const horaActual = ahora.getHours();

    // Buscar si tiene reserva para hoy en algún horario cercano (±2h)
    const reserva = await prisma.reserva.findFirst({
      where: {
        usuarioId: usuario.id,
        fecha: hoy,
        estado: 'RESERVADA',
        horario: {
          horaInicio: { gte: horaActual - 2, lte: horaActual + 2 }
        }
      },
      include: { horario: { include: { tipoClase: true } } }
    });

    if (reserva) {
      // Tiene reserva, marcar como asistió
      await prisma.reserva.update({
        where: { id: reserva.id },
        data: { estado: 'ASISTIO' }
      });

      await prisma.asistencia.create({
        data: {
          usuarioId: usuario.id,
          horarioId: reserva.horarioId,
          fecha: hoy,
          metodo: 'RESERVA',
          creditoConsumido: false
        }
      });

      await verificarLogros(usuario.id);

      await enviarWhatsApp({
        usuarioId: usuario.id,
        telefono: usuario.celular,
        tipo: 'CHECKIN',
        mensaje: `Check-in registrado. Bienvenido a RAM Performance, ${usuario.nombre}!`
      });

      return res.json({
        success: true,
        message: `¡Bienvenido, ${usuario.nombre}! Tu reserva para ${reserva.horario.tipoClase.titulo} a las ${reserva.horario.horaInicio}:00 hs fue confirmada.`,
        creditosRestantes: usuarioActualizado.creditos,
        clase: reserva.horario.tipoClase.titulo,
        hora: reserva.horario.horaInicio
      });
    }

    // No tiene reserva, verificar créditos
    if (usuarioActualizado.creditos < 1) {
      return res.status(400).json({
        success: false,
        error: `No tenés créditos disponibles. Tenés ${usuarioActualizado.creditos} clases vigentes. Acercate a recepción para recargar.`
      });
    }

    // Buscar horario más cercano
    const horario = await prisma.horario.findFirst({
      where: {
        activo: true,
        diaSemana: ahora.getDay(),
        horaInicio: { gte: horaActual - 1, lte: horaActual + 1 }
      },
      include: { tipoClase: true }
    });

    if (!horario) {
      // Buscar turnos del día para mostrar
      const turnosHoy = await prisma.horario.findMany({
        where: {
          activo: true,
          diaSemana: ahora.getDay()
        },
        include: { tipoClase: true },
        orderBy: { horaInicio: 'asc' }
      });

      if (turnosHoy.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Hoy no hay turnos disponibles. Los horarios son de lunes a sábado.'
        });
      }

      const listaTurnos = turnosHoy.map(t => `${t.horaInicio}:00 (${t.tipoClase.titulo})`).join(', ');
      return res.status(400).json({
        success: false,
        error: `No hay turnos activos en este horario (actual: ${horaActual}:00 hs). Los turnos de hoy son: ${listaTurnos}.`,
        turnosHoy: turnosHoy.map(t => ({ hora: t.horaInicio, clase: t.tipoClase.titulo }))
      });
    }

    // Verificar cupo
    const reservasCount = await prisma.reserva.count({
      where: { horarioId: horario.id, fecha: hoy, estado: { in: ['RESERVADA', 'ASISTIO'] } }
    });
    const asistenciasCount = await prisma.asistencia.count({
      where: { horarioId: horario.id, fecha: hoy }
    });
    if (reservasCount + asistenciasCount >= horario.cupoMaximo) {
      return res.status(400).json({
        success: false,
        error: `El turno de ${horario.tipoClase.titulo} a las ${horario.horaInicio}:00 hs está completo. Los ${horario.cupoMaximo} lugares ya fueron ocupados.`
      });
    }

    // Consumir crédito FIFO
    const consumo = await consumirCreditoFIFO(usuario.id);
    if (!consumo.success) {
      return res.status(400).json({
        success: false,
        error: 'No tenés créditos disponibles. Acercate a recepción para recargar.'
      });
    }

    // Crear asistencia
    await prisma.asistencia.create({
      data: {
        usuarioId: usuario.id,
        horarioId: horario.id,
        fecha: hoy,
        metodo: 'CHECKIN',
        creditoConsumido: true
      }
    });

    await verificarLogros(usuario.id);

    await enviarWhatsApp({
      usuarioId: usuario.id,
      telefono: usuario.celular,
      tipo: 'CHECKIN',
      mensaje: `Check-in registrado. Bienvenido a RAM Performance, ${usuario.nombre}! Te quedan ${consumo.creditosRestantes} clases.`
    });

    res.json({
      success: true,
      message: `¡Bienvenido, ${usuario.nombre}! Te registramos en ${horario.tipoClase.titulo} a las ${horario.horaInicio}:00 hs. Consumiste 1 crédito. Te quedan ${consumo.creditosRestantes} clases disponibles.`,
      creditosRestantes: consumo.creditosRestantes,
      clase: horario.tipoClase.titulo,
      hora: horario.horaInicio
    });
  } catch (error) {
    console.error('Checkin error:', error);
    res.status(500).json({ error: 'Ups, algo salió mal. Intentá de nuevo en unos segundos.' });
  }
};
