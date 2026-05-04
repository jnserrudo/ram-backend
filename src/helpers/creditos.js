import { prisma } from '../config/prisma.js';

export async function recalcularCreditos(usuarioId) {
  const ahora = new Date();
  ahora.setHours(0, 0, 0, 0);

  const comprasVigentes = await prisma.compraCredito.findMany({
    where: {
      usuarioId,
      estado: 'ACTIVO',
      fechaVencimiento: { gte: ahora }
    }
  });

  const total = comprasVigentes.reduce((sum, c) => sum + (c.creditosOtorgados - c.creditosConsumidos), 0);

  await prisma.usuario.update({
    where: { id: usuarioId },
    data: { creditos: total }
  });

  return total;
}

export async function consumirCreditoFIFO(usuarioId) {
  const ahora = new Date();
  ahora.setHours(0, 0, 0, 0);

  const compra = await prisma.compraCredito.findFirst({
    where: {
      usuarioId,
      estado: 'ACTIVO',
      fechaVencimiento: { gte: ahora },
      creditosConsumidos: { lt: prisma.compraCredito.fields.creditosOtorgados }
    },
    orderBy: { fechaInicio: 'asc' }
  });

  if (!compra) {
    return { success: false, error: 'No hay créditos disponibles' };
  }

  const nuevosConsumidos = compra.creditosConsumidos + 1;
  const nuevoEstado = nuevosConsumidos >= compra.creditosOtorgados ? 'CONSUMIDO' : 'ACTIVO';

  await prisma.compraCredito.update({
    where: { id: compra.id },
    data: {
      creditosConsumidos: nuevosConsumidos,
      estado: nuevoEstado
    }
  });

  const total = await recalcularCreditos(usuarioId);

  return { success: true, compraId: compra.id, creditosRestantes: total };
}

export async function devolverCreditoFIFO(usuarioId) {
  const compra = await prisma.compraCredito.findFirst({
    where: {
      usuarioId,
      estado: { in: ['ACTIVO', 'CONSUMIDO'] },
      creditosConsumidos: { gt: 0 }
    },
    orderBy: { fechaInicio: 'desc' }
  });

  if (!compra) {
    return { success: false, error: 'No hay créditos para devolver' };
  }

  const nuevosConsumidos = compra.creditosConsumidos - 1;
  const nuevoEstado = nuevosConsumidos < compra.creditosOtorgados ? 'ACTIVO' : compra.estado;

  await prisma.compraCredito.update({
    where: { id: compra.id },
    data: {
      creditosConsumidos: nuevosConsumidos,
      estado: nuevoEstado
    }
  });

  const total = await recalcularCreditos(usuarioId);

  return { success: true, compraId: compra.id, creditosRestantes: total };
}

export async function verificarCreditosVencidos(usuarioId) {
  const ahora = new Date();
  ahora.setHours(0, 0, 0, 0);

  await prisma.compraCredito.updateMany({
    where: {
      usuarioId,
      estado: 'ACTIVO',
      fechaVencimiento: { lt: ahora }
    },
    data: { estado: 'VENCIDO' }
  });

  return recalcularCreditos(usuarioId);
}
