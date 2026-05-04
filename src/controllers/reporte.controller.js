import { prisma } from '../config/prisma.js';

export const reporteAsistencias = async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    const where = {};
    if (desde && hasta) {
      where.fecha = { gte: new Date(desde), lte: new Date(hasta) };
    }

    const asistencias = await prisma.asistencia.findMany({
      where,
      include: { horario: { include: { tipoClase: true } } }
    });

    const porClase = {};
    const porHorario = {};
    asistencias.forEach(a => {
      const clase = a.horario.tipoClase.titulo;
      const hora = `${a.horario.diaSemana}-${a.horario.horaInicio}`;
      porClase[clase] = (porClase[clase] || 0) + 1;
      porHorario[hora] = (porHorario[hora] || 0) + 1;
    });

    res.json({ total: asistencias.length, porClase, porHorario });
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

export const reporteUsuarios = async (req, res) => {
  try {
    const usuarios = await prisma.usuario.findMany({
      where: { rol: 'USER', activo: true },
      include: { asistencias: true, reservas: true }
    });

    const topUsuarios = usuarios
      .map(u => ({
        id: u.id,
        nombre: `${u.nombre} ${u.apellido}`,
        dni: u.dni,
        asistencias: u.asistencias.length,
        reservas: u.reservas.length,
        creditos: u.creditos
      }))
      .sort((a, b) => b.asistencias - a.asistencias)
      .slice(0, 10);

    res.json(topUsuarios);
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

export const reporteFinanciero = async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    const where = {};
    if (desde && hasta) {
      where.fechaPago = { gte: new Date(desde), lte: new Date(hasta) };
    }

    const compras = await prisma.compraCredito.findMany({ where, include: { paquete: true } });

    const porMes = {};
    let total = 0;
    compras.forEach(c => {
      const mes = c.fechaPago.toISOString().slice(0, 7);
      porMes[mes] = (porMes[mes] || 0) + c.totalPagado;
      total += c.totalPagado;
    });

    res.json({ total, porMes, compras: compras.length });
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};
