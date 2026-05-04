import { prisma } from './prisma.js';

export async function enviarWhatsApp({ usuarioId, telefono, mensaje, tipo }) {
  try {
    // Por ahora solo simulamos: log en consola + guardar en DB
    console.log(`[WhatsApp] Enviando a ${telefono}: ${mensaje}`);

    await prisma.whatsAppLog.create({
      data: {
        usuarioId,
        tipo,
        telefono,
        mensaje,
        estado: 'ENVIADO'
      }
    });

    return true;
  } catch (error) {
    console.error('[WhatsApp] Error:', error.message);

    await prisma.whatsAppLog.create({
      data: {
        usuarioId,
        tipo,
        telefono,
        mensaje,
        estado: 'FALLIDO',
        error: error.message
      }
    });

    return false;
  }
}
