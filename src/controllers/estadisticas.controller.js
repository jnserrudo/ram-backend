import { prisma } from '../config/prisma.js';

export const obtenerEstadisticasUsuario = async (req, res) => {
  try {
    const { id } = req.params;
    const usuarioId = parseInt(id);

    const hace30Dias = new Date();
    hace30Dias.setDate(hace30Dias.getDate() - 30);
    hace30Dias.setHours(0, 0, 0, 0);

    const mesActual = new Date();
    mesActual.setDate(1);
    mesActual.setHours(0, 0, 0, 0);

    const mesAnterior = new Date(mesActual);
    mesAnterior.setMonth(mesAnterior.getMonth() - 1);
    const finMesAnterior = new Date(mesActual);
    finMesAnterior.setMilliseconds(-1);

    // Ejecutar todas las consultas en paralelo
    const [asistenciasRecientes, asistenciasPorTipoRaw, totalAsistencias, asistenciasMesActual, asistenciasMesAnterior, comprasActivas] = await Promise.all([
      prisma.asistencia.findMany({
        where: { usuarioId, fecha: { gte: hace30Dias } },
        orderBy: { fecha: 'asc' },
        include: { horario: { include: { tipoClase: true } } }
      }),
      prisma.asistencia.groupBy({
        by: ['horarioId'],
        where: { usuarioId, fecha: { gte: hace30Dias } },
        _count: true
      }),
      prisma.asistencia.count({ where: { usuarioId } }),
      prisma.asistencia.count({ where: { usuarioId, fecha: { gte: mesActual } } }),
      prisma.asistencia.count({ where: { usuarioId, fecha: { gte: mesAnterior, lte: finMesAnterior } } }),
      prisma.compraCredito.findMany({
        where: {
          usuarioId,
          estado: 'ACTIVO',
          creditosConsumidos: { lt: prisma.compraCredito.fields.creditosOtorgados }
        },
        orderBy: { fechaVencimiento: 'asc' },
        include: { paquete: true }
      })
    ]);

    // Procesar datos en memoria (mucho más rápido que más queries)
    const clasesPorTipoObj = {};
    asistenciasRecientes.forEach(a => {
      const tipo = a.horario?.tipoClase?.titulo || 'Desconocido';
      clasesPorTipoObj[tipo] = (clasesPorTipoObj[tipo] || 0) + 1;
    });

    const clasesPorTipo = Object.entries(clasesPorTipoObj).map(([tipo, cantidad]) => ({ tipo, cantidad }));

    const asistenciasAgrupadasObj = {};
    asistenciasRecientes.forEach(a => {
      const f = a.fecha.toISOString().split('T')[0];
      asistenciasAgrupadasObj[f] = (asistenciasAgrupadasObj[f] || 0) + 1;
    });

    const asistenciasPorDia = Object.entries(asistenciasAgrupadasObj).map(([fecha, cantidad]) => ({ fecha, cantidad }));

    const proximoVencimiento = comprasActivas.length > 0 
      ? comprasActivas[0].fechaVencimiento 
      : null;

    res.json({
      asistenciasPorDia,
      clasesPorTipo,
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
