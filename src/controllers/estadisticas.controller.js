import { prisma } from '../config/prisma.js';

export const obtenerEstadisticasUsuario = async (req, res) => {
  try {
    const { id } = req.params;
    const usuarioId = parseInt(id);

    const hace30Dias = new Date();
    hace30Dias.setDate(hace30Dias.getDate() - 30);

    const asistenciasPorDia = await prisma.asistencia.findMany({
      where: {
        usuarioId,
        fecha: { gte: hace30Dias }
      },
      orderBy: { fecha: 'asc' },
      select: {
        fecha: true,
        horario: {
          select: {
            tipoClase: {
              select: { titulo: true }
            }
          }
        }
      }
    });

    const asistenciasPorTipo = await prisma.asistencia.groupBy({
      by: ['horarioId'],
      where: {
        usuarioId,
        fecha: { gte: hace30Dias }
      },
      _count: true
    });

    const horariosIds = asistenciasPorTipo.map(a => a.horarioId);
    const horarios = await prisma.horario.findMany({
      where: { id: { in: horariosIds } },
      include: { tipoClase: true }
    });

    const clasesPorTipo = asistenciasPorTipo.map(a => {
      const horario = horarios.find(h => h.id === a.horarioId);
      return {
        tipo: horario?.tipoClase?.titulo || 'Desconocido',
        cantidad: a._count
      };
    });

    const agrupado = clasesPorTipo.reduce((acc, item) => {
      const existente = acc.find(x => x.tipo === item.tipo);
      if (existente) {
        existente.cantidad += item.cantidad;
      } else {
        acc.push({ tipo: item.tipo, cantidad: item.cantidad });
      }
      return acc;
    }, []);

    const totalAsistencias = await prisma.asistencia.count({
      where: { usuarioId }
    });

    const mesActual = new Date();
    mesActual.setDate(1);
    mesActual.setHours(0, 0, 0, 0);

    const asistenciasMesActual = await prisma.asistencia.count({
      where: {
        usuarioId,
        fecha: { gte: mesActual }
      }
    });

    const mesAnterior = new Date(mesActual);
    mesAnterior.setMonth(mesAnterior.getMonth() - 1);
    const finMesAnterior = new Date(mesActual);
    finMesAnterior.setMilliseconds(-1);

    const asistenciasMesAnterior = await prisma.asistencia.count({
      where: {
        usuarioId,
        fecha: {
          gte: mesAnterior,
          lte: finMesAnterior
        }
      }
    });

    const comprasActivas = await prisma.compraCredito.findMany({
      where: {
        usuarioId,
        estado: 'ACTIVO',
        creditosConsumidos: { lt: prisma.compraCredito.fields.creditosOtorgados }
      },
      orderBy: { fechaVencimiento: 'asc' },
      select: {
        fechaVencimiento: true,
        creditosOtorgados: true,
        creditosConsumidos: true,
        paquete: {
          select: { titulo: true }
        }
      }
    });

    const proximoVencimiento = comprasActivas.length > 0 
      ? comprasActivas[0].fechaVencimiento 
      : null;

    const asistenciasPorDiaFormateado = asistenciasPorDia.map(a => ({
      fecha: a.fecha.toISOString().split('T')[0],
      cantidad: 1
    }));

    const asistenciasAgrupadas = asistenciasPorDiaFormateado.reduce((acc, item) => {
      const existente = acc.find(x => x.fecha === item.fecha);
      if (existente) {
        existente.cantidad += 1;
      } else {
        acc.push({ fecha: item.fecha, cantidad: 1 });
      }
      return acc;
    }, []);

    res.json({
      asistenciasPorDia: asistenciasAgrupadas,
      clasesPorTipo: agrupado,
      totalAsistencias,
      asistenciasMesActual,
      asistenciasMesAnterior,
      proximoVencimiento,
      comprasActivas: comprasActivas.map(c => ({
        paquete: c.paquete.titulo,
        creditosRestantes: c.creditosOtorgados - c.creditosConsumidos,
        vence: c.fechaVencimiento
      }))
    });
  } catch (error) {
    console.error('Error estadísticas:', error);
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
};
