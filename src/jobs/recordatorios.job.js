import { prisma } from '../config/prisma.js';
import { enviarWhatsApp } from '../config/whatsapp.js';

export const enviarRecordatorios = async () => {
  try {
    const ahora = new Date();
    const dosHorasAdelante = new Date(ahora.getTime() + 2 * 60 * 60 * 1000);
    const tresHorasAdelante = new Date(ahora.getTime() + 3 * 60 * 60 * 1000);

    const reservas = await prisma.reserva.findMany({
      where: {
        fecha: {
          gte: dosHorasAdelante,
          lte: tresHorasAdelante
        },
        estado: 'RESERVADA',
        recordatorioEnviado: false
      },
      include: {
        usuario: true,
        horario: {
          include: {
            tipoClase: true
          }
        }
      }
    });

    console.log(`[Recordatorios] Encontradas ${reservas.length} reservas para recordar`);

    for (const reserva of reservas) {
      const horaClase = reserva.horario.horaInicio;
      const nombreClase = reserva.horario.tipoClase.titulo;
      
      await enviarWhatsApp({
        usuarioId: reserva.usuario.id,
        telefono: reserva.usuario.celular,
        tipo: 'RECORDATORIO',
        mensaje: `Hola ${reserva.usuario.nombre}! Te recordamos tu clase de ${nombreClase} hoy a las ${horaClase}:00hs. Si no podés venir, cancelá desde la app para recuperar tu crédito. Nos vemos! 💪`
      });

      await prisma.reserva.update({
        where: { id: reserva.id },
        data: { recordatorioEnviado: true }
      });

      console.log(`[Recordatorios] Enviado a ${reserva.usuario.nombre} - ${nombreClase} ${horaClase}:00hs`);
    }

    return { success: true, enviados: reservas.length };
  } catch (error) {
    console.error('[Recordatorios] Error:', error);
    return { success: false, error: error.message };
  }
};
