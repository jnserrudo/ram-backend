import { prisma } from '../config/prisma.js';
import { enviarWhatsApp } from '../config/whatsapp.js';
import { recalcularCreditos } from '../helpers/creditos.js';

export const registrarCompra = async (req, res) => {
  try {
    const { usuarioId, paqueteId, metodoPago } = req.body;

    const paquete = await prisma.paqueteCredito.findUnique({ where: { id: parseInt(paqueteId) } });
    if (!paquete || !paquete.activo) {
      return res.status(400).json({ error: 'Paquete no válido' });
    }

    const usuario = await prisma.usuario.findUnique({ where: { id: parseInt(usuarioId) } });
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });

    const ahora = new Date();
    const fechaVencimiento = new Date(ahora);
    fechaVencimiento.setDate(fechaVencimiento.getDate() + paquete.duracionDias);
    fechaVencimiento.setHours(23, 59, 59, 999);

    const compra = await prisma.compraCredito.create({
      data: {
        usuarioId: parseInt(usuarioId),
        paqueteId: parseInt(paqueteId),
        creditosOtorgados: paquete.cantidadCreditos,
        totalPagado: paquete.precio,
        metodoPago,
        fechaInicio: ahora,
        fechaVencimiento
      }
    });

    const nuevoCreditos = await recalcularCreditos(parseInt(usuarioId));

    await enviarWhatsApp({
      usuarioId: usuario.id,
      telefono: usuario.celular,
      tipo: 'PAGO',
      mensaje: `Hola ${usuario.nombre}, se te acreditaron ${paquete.cantidadCreditos} clases (${paquete.titulo}). Total disponible: ${nuevoCreditos}. Vencen el ${fechaVencimiento.toLocaleDateString('es-AR')}. Gracias por elegir RAM Performance!`
    });

    res.status(201).json({
      message: 'Compra registrada',
      compra: { ...compra, paquete },
      creditosNuevos: nuevoCreditos,
      fechaVencimiento
    });
  } catch (error) {
    console.error('Compra error:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
};

export const listarCompras = async (req, res) => {
  try {
    const compras = await prisma.compraCredito.findMany({
      include: { usuario: { select: { id: true, nombre: true, apellido: true, dni: true } }, paquete: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(compras);
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

export const misCompras = async (req, res) => {
  try {
    const compras = await prisma.compraCredito.findMany({
      where: { usuarioId: req.user.id },
      include: { paquete: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(compras);
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};
