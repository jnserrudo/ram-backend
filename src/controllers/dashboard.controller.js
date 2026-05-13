import { prisma } from '../config/prisma.js';

export const obtenerMetricas = async (req, res) => {
  try {
    const ahora = new Date();
    const hoyInicio = new Date(ahora);
    hoyInicio.setHours(0, 0, 0, 0);
    const hoyFin = new Date(ahora);
    hoyFin.setHours(23, 59, 59, 999);

    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    
    const hace4Semanas = new Date(ahora);
    hace4Semanas.setDate(ahora.getDate() - 28);

    const [
      totalUsuarios,
      usuariosActivos,
      reservasHoy,
      asistenciasHoy,
      ventasMes,
      totalVentas,
      asistenciasUltimos30Dias,
      clasesPopulares
    ] = await Promise.all([
      prisma.usuario.count({ where: { rol: 'USER' } }),
      prisma.usuario.count({ where: { rol: 'USER', activo: true } }),
      prisma.reserva.count({ where: { fecha: { gte: hoyInicio, lte: hoyFin }, estado: 'RESERVADA' } }),
      prisma.asistencia.count({ where: { fecha: { gte: hoyInicio, lte: hoyFin } } }),
      prisma.compraCredito.aggregate({
        where: { createdAt: { gte: inicioMes } },
        _sum: { totalPagado: true, creditosOtorgados: true }
      }),
      prisma.compraCredito.aggregate({
        _sum: { totalPagado: true }
      }),
      prisma.asistencia.findMany({
        where: { createdAt: { gte: hace4Semanas } },
        include: { horario: { include: { tipoClase: true } } }
      }),
      prisma.asistencia.groupBy({
        by: ['horarioId'],
        _count: { horarioId: true },
        orderBy: { _count: { horarioId: 'desc' } },
        take: 5
      })
    ]);

    // Procesar asistencias por día para el gráfico (Usar la consulta unificada)
    const asistenciasPorDia = Array(7).fill(0);
    const diasSemana = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    
    // Agrupar asistencias de las últimas 4 semanas por día de la semana
    asistenciasUltimos30Dias.forEach(asist => {
      const dia = new Date(asist.createdAt).getDay();
      asistenciasPorDia[dia]++;
    });

    const chartAsistencias = diasSemana.map((name, index) => ({
      name,
      value: Math.round(asistenciasPorDia[index] / 4) // Promedio semanal de las últimas 4 semanas
    }));

    // Clases populares con nombres
    const horariosIds = clasesPopulares.map(cp => cp.horarioId);
    const horariosInfo = await prisma.horario.findMany({
      where: { id: { in: horariosIds } },
      include: { tipoClase: true }
    });

    const chartClasesPopulares = clasesPopulares.map(cp => {
      const h = horariosInfo.find(x => x.id === cp.horarioId);
      return {
        name: h?.tipoClase.titulo || 'Desconocida',
        value: cp._count.horarioId
      };
    });

    res.json({
      kpis: {
        totalUsuarios,
        usuariosActivos,
        reservasHoy,
        asistenciasHoy,
        ventasMes: ventasMes._sum.totalPagado || 0,
        creditosVendidosMes: ventasMes._sum.creditosOtorgados || 0,
        totalRecaudado: totalVentas._sum.totalPagado || 0
      },
      charts: {
        asistenciasPorDia: chartAsistencias,
        clasesPopulares: chartClasesPopulares
      }
    });
  } catch (error) {
    console.error('Error obtenerMetricas:', error);
    res.status(500).json({ error: 'Error al obtener métricas' });
  }
};

export const obtenerInscriptosSemana = async (req, res) => {
  try {
    const { fecha } = req.query;
    const fechaRef = fecha ? new Date(fecha) : new Date();
    
    // Calcular lunes de la semana de la fechaRef
    const lunes = new Date(fechaRef);
    const diaSemana = lunes.getDay(); // 0: Dom, 1: Lun...
    const diff = lunes.getDate() - diaSemana + (diaSemana === 0 ? -6 : 1);
    lunes.setDate(diff);
    lunes.setHours(0, 0, 0, 0);

    const domingo = new Date(lunes);
    domingo.setDate(lunes.getDate() + 6);
    domingo.setHours(23, 59, 59, 999);

    const horarios = await prisma.horario.findMany({
      where: { activo: true },
      include: { 
        tipoClase: true
      },
      orderBy: [{ diaSemana: 'asc' }, { horaInicio: 'asc' }]
    });

    const reservas = await prisma.reserva.findMany({
      where: {
        fecha: { gte: lunes, lte: domingo },
        estado: { in: ['RESERVADA', 'ASISTIO'] }
      },
      include: {
        usuario: {
          select: { id: true, nombre: true, apellido: true, dni: true, celular: true }
        }
      }
    });

    const asistencias = await prisma.asistencia.findMany({
      where: {
        fecha: { gte: lunes, lte: domingo }
      },
      include: {
        usuario: {
          select: { id: true, nombre: true, apellido: true, dni: true, celular: true }
        }
      }
    });

    // Agrupar por día y horario
    const resultado = [];
    
    for (let i = 0; i < 7; i++) {
      const fechaDia = new Date(lunes);
      fechaDia.setDate(lunes.getDate() + i);
      const diaSemana = (i + 1) % 7; // Ajuste para que 1=Lunes, ..., 0=Domingo

      const horariosDia = horarios.filter(h => h.diaSemana === diaSemana);
      
      const turnos = horariosDia.map(h => {
        // Filtrar y deduplicar inscriptos (reservas)
        const uniqueInscriptos = new Map();
        reservas
          .filter(r => {
            const rFecha = new Date(r.fecha).toISOString().split('T')[0];
            const dFecha = fechaDia.toISOString().split('T')[0];
            return r.horarioId === h.id && rFecha === dFecha;
          })
          // Ordenamos por creación descendente para quedarnos con la última acción del usuario
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .forEach(r => {
            if (!uniqueInscriptos.has(r.usuario.id)) {
              uniqueInscriptos.set(r.usuario.id, {
                id: r.usuario.id,
                nombre: r.usuario.nombre,
                apellido: r.usuario.apellido,
                dni: r.usuario.dni,
                celular: r.usuario.celular,
                estado: r.estado,
                realizadaEl: r.createdAt // Nueva data: fecha de creación de la reserva
              });
            }
          });

        const inscriptos = Array.from(uniqueInscriptos.values());

        // Filtrar y deduplicar asistencias
        const uniqueAsistencias = new Map();
        asistencias
          .filter(a => {
            const aFecha = new Date(a.fecha).toISOString().split('T')[0];
            const dFecha = fechaDia.toISOString().split('T')[0];
            return a.horarioId === h.id && aFecha === dFecha;
          })
          .forEach(a => {
            if (!uniqueAsistencias.has(a.usuario.id)) {
              uniqueAsistencias.set(a.usuario.id, {
                id: a.usuario.id,
                nombre: a.usuario.nombre,
                apellido: a.usuario.apellido,
                dni: a.usuario.dni,
                celular: a.usuario.celular,
                metodo: a.metodo
              });
            }
          });

        const checkins = Array.from(uniqueAsistencias.values());

        return {
          id: h.id,
          clase: h.tipoClase.titulo,
          hora: h.horaInicio,
          bloque: h.bloque,
          cupoMaximo: h.cupoMaximo,
          inscriptos,
          checkins,
          total: new Set([...uniqueInscriptos.keys(), ...uniqueAsistencias.keys()]).size
        };
      });

      resultado.push({
        fecha: fechaDia.toISOString().split('T')[0],
        diaNombre: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][fechaDia.getDay()],
        turnos
      });
    }

    res.json(resultado);
  } catch (error) {
    console.error('Error obtenerInscriptosSemana:', error);
    res.status(500).json({ error: 'Error al obtener inscriptos' });
  }
};

export const obtenerHistoricoInscriptos = async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    if (!desde || !hasta) return res.status(400).json({ error: 'Faltan fechas' });

    const inicio = new Date(desde);
    inicio.setHours(0, 0, 0, 0);
    const fin = new Date(hasta);
    fin.setHours(23, 59, 59, 999);

    const reservas = await prisma.reserva.findMany({
      where: {
        fecha: { gte: inicio, lte: fin },
        estado: { in: ['RESERVADA', 'ASISTIO'] }
      },
      include: {
        usuario: { select: { nombre: true, apellido: true, dni: true, celular: true } },
        horario: { include: { tipoClase: true } }
      },
      orderBy: { fecha: 'desc' }
    });

    res.json(reservas);
  } catch (error) {
    console.error('Error obtenerHistoricoInscriptos:', error);
    res.status(500).json({ error: 'Error al obtener histórico' });
  }
};
