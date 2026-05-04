import { prisma } from '../config/prisma.js';

export const listarAuditoria = async (req, res) => {
  try {
    const { page = 1, limit = 50, accion, entidad, impacto, usuarioDni, desde, hasta } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (accion) where.accion = accion;
    if (entidad) where.entidad = entidad;
    if (impacto) where.impacto = impacto;
    if (usuarioDni) where.usuarioDni = { contains: usuarioDni };
    if (desde && hasta) {
      where.fechaHora = { gte: new Date(desde), lte: new Date(hasta) };
    }

    const [logs, total] = await Promise.all([
      prisma.auditoria.findMany({
        where,
        orderBy: { fechaHora: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.auditoria.count({ where })
    ]);

    res.json({ logs, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
  } catch (error) {
    console.error('Auditoria error:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
};

export const detalleAuditoria = async (req, res) => {
  try {
    const { id } = req.params;
    const log = await prisma.auditoria.findUnique({ where: { id: parseInt(id) } });
    if (!log) return res.status(404).json({ error: 'Log no encontrado' });
    res.json(log);
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

export const estadisticasAuditoria = async (req, res) => {
  try {
    const porAccion = await prisma.auditoria.groupBy({ by: ['accion'], _count: true });
    const porEntidad = await prisma.auditoria.groupBy({ by: ['entidad'], _count: true });
    const porImpacto = await prisma.auditoria.groupBy({ by: ['impacto'], _count: true });

    const topUsuarios = await prisma.auditoria.groupBy({
      by: ['usuarioDni'],
      _count: true,
      orderBy: { _count: { id: 'desc' } },
      take: 10
    });

    res.json({ porAccion, porEntidad, porImpacto, topUsuarios });
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};
