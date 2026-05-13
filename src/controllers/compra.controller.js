import { MercadoPagoConfig, Preference } from 'mercadopago';
import { prisma } from '../config/prisma.js';
import { enviarWhatsApp } from '../config/whatsapp.js';
import { recalcularCreditos } from '../helpers/creditos.js';

// MercadoPago Client (se activará cuando pongas el MP_ACCESS_TOKEN en el .env)
const mpClient = process.env.MP_ACCESS_TOKEN 
  ? new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN })
  : null;

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

// --- MERCADOPAGO BOILERPLATE ---

export const crearPreferenciaMP = async (req, res) => {
  try {
    if (!mpClient) {
      return res.status(503).json({ error: 'MercadoPago no está configurado todavía.' });
    }

    const { paqueteId } = req.body;
    const usuarioId = req.user.id;

    const [paquete, usuario] = await Promise.all([
      prisma.paqueteCredito.findUnique({ where: { id: parseInt(paqueteId) } }),
      prisma.usuario.findUnique({ where: { id: usuarioId } })
    ]);

    if (!paquete) return res.status(404).json({ error: 'Paquete no encontrado' });

    const preference = new Preference(mpClient);
    const result = await preference.create({
      body: {
        items: [
          {
            id: paquete.id.toString(),
            title: `Pack RAM: ${paquete.titulo}`,
            quantity: 1,
            unit_price: paquete.precio,
            currency_id: 'ARS'
          }
        ],
        payer: {
          email: usuario.email,
          name: usuario.nombre,
          surname: usuario.apellido
        },
        back_urls: {
          success: `${process.env.FRONTEND_URL}/paquetes?status=success`,
          failure: `${process.env.FRONTEND_URL}/paquetes?status=failure`,
          pending: `${process.env.FRONTEND_URL}/paquetes?status=pending`
        },
        auto_return: 'approved',
        notification_url: `${process.env.BACKEND_URL}/api/compras/webhook/mercadopago`,
        external_reference: `${usuarioId}-${paqueteId}`
      }
    });

    res.json({ id: result.id, init_point: result.init_point });
  } catch (error) {
    console.error('MP Preference Error:', error);
    res.status(500).json({ error: 'Error al crear preferencia de pago' });
  }
};

export const webhookMP = async (req, res) => {
  try {
    const { topic, resource, 'data.id': dataId } = req.query;
    const paymentId = dataId || req.body.data?.id;

    if (!paymentId) return res.sendStatus(200);

    console.log('Webhook recibido de MP. Pago ID:', paymentId);
    res.sendStatus(200);
  } catch (error) {
    console.error('Webhook MP Error:', error);
    res.sendStatus(500);
  }
};
