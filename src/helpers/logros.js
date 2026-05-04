import { prisma } from '../config/prisma.js';

const LOGROS_CONFIG = {
  ASISTENCIA_5: {
    titulo: 'Primera Semana',
    descripcion: 'Completaste 5 asistencias',
    icono: '🎯',
    umbral: 5
  },
  ASISTENCIA_10: {
    titulo: 'Constancia',
    descripcion: 'Completaste 10 asistencias',
    icono: '💪',
    umbral: 10
  },
  ASISTENCIA_20: {
    titulo: 'Dedicación',
    descripcion: 'Completaste 20 asistencias',
    icono: '🔥',
    umbral: 20
  },
  ASISTENCIA_50: {
    titulo: 'Leyenda',
    descripcion: 'Completaste 50 asistencias',
    icono: '👑',
    umbral: 50
  },
  RACHA_SEMANAL: {
    titulo: 'Racha Semanal',
    descripcion: 'Entrenaste 4 veces en una semana',
    icono: '⚡',
    umbral: 4
  },
  PRIMER_MES: {
    titulo: 'Primer Mes',
    descripcion: 'Completaste tu primer mes de entrenamiento',
    icono: '🎉',
    umbral: 30
  }
};

export const verificarLogros = async (usuarioId) => {
  try {
    const totalAsistencias = await prisma.asistencia.count({
      where: { usuarioId }
    });

    const logrosObtenidos = await prisma.logro.findMany({
      where: { usuarioId },
      select: { tipo: true }
    });

    const tiposObtenidos = logrosObtenidos.map(l => l.tipo);
    const nuevosLogros = [];

    for (const [tipo, config] of Object.entries(LOGROS_CONFIG)) {
      if (tiposObtenidos.includes(tipo)) continue;

      let cumple = false;

      if (tipo.startsWith('ASISTENCIA_')) {
        cumple = totalAsistencias >= config.umbral;
      } else if (tipo === 'RACHA_SEMANAL') {
        const hace7Dias = new Date();
        hace7Dias.setDate(hace7Dias.getDate() - 7);
        const asistenciasSemana = await prisma.asistencia.count({
          where: {
            usuarioId,
            fecha: { gte: hace7Dias }
          }
        });
        cumple = asistenciasSemana >= config.umbral;
      } else if (tipo === 'PRIMER_MES') {
        const usuario = await prisma.usuario.findUnique({
          where: { id: usuarioId },
          select: { createdAt: true }
        });
        const hace30Dias = new Date();
        hace30Dias.setDate(hace30Dias.getDate() - 30);
        cumple = usuario.createdAt <= hace30Dias && totalAsistencias >= 8;
      }

      if (cumple) {
        const nuevoLogro = await prisma.logro.create({
          data: {
            usuarioId,
            tipo,
            titulo: config.titulo,
            descripcion: config.descripcion,
            icono: config.icono
          }
        });
        nuevosLogros.push(nuevoLogro);

        await prisma.notificacion.create({
          data: {
            usuarioId,
            tipo: 'SISTEMA',
            titulo: `¡Nuevo logro desbloqueado! ${config.icono}`,
            mensaje: `${config.titulo}: ${config.descripcion}`
          }
        });
      }
    }

    return nuevosLogros;
  } catch (error) {
    console.error('Error verificando logros:', error);
    return [];
  }
};
