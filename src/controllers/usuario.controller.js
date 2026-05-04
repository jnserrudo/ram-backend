import { prisma } from '../config/prisma.js';
import bcrypt from 'bcryptjs';
import { recalcularCreditos } from '../helpers/creditos.js';
import { enviarWhatsApp } from '../config/whatsapp.js';

export const crearUsuario = async (req, res) => {
  try {
    const { dni, nombre, apellido, email, celular, paqueteId, creditosIniciales } = req.body;

    const existente = await prisma.usuario.findUnique({ where: { dni } });
    if (existente) {
      return res.status(400).json({ error: 'Ya existe un usuario con ese DNI.' });
    }

    const hash = await bcrypt.hash(dni, 10);

    const usuario = await prisma.usuario.create({
      data: {
        dni,
        nombre,
        apellido,
        email,
        celular,
        password_hash: hash,
        rol: 'USER',
        creditos: 0,
        activo: true,
        requiereCambioPassword: true
      }
    });

    if (paqueteId) {
      const paquete = await prisma.paqueteCredito.findUnique({ where: { id: parseInt(paqueteId) } });
      if (paquete && paquete.activo) {
        const ahora = new Date();
        const fechaVencimiento = new Date(ahora);
        fechaVencimiento.setDate(fechaVencimiento.getDate() + paquete.duracionDias);
        fechaVencimiento.setHours(23, 59, 59, 999);

        await prisma.compraCredito.create({
          data: {
            usuarioId: usuario.id,
            paqueteId: paquete.id,
            creditosOtorgados: paquete.cantidadCreditos,
            totalPagado: paquete.precio,
            metodoPago: 'Registro inicial',
            fechaInicio: ahora,
            fechaVencimiento
          }
        });
      }
    }

    await recalcularCreditos(usuario.id);

    await enviarWhatsApp({
      usuarioId: usuario.id,
      telefono: usuario.celular,
      tipo: 'SISTEMA',
      mensaje: `Hola ${usuario.nombre}, bienvenido a RAM Performance! Tu DNI (${usuario.dni}) es tu usuario y tu contraseña temporal es tu DNI. Ingresá y cambiala por seguridad.`
    });

    res.status(201).json({
      message: 'Usuario creado exitosamente',
      usuario: {
        id: usuario.id,
        dni: usuario.dni,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        passwordTemporal: dni
      }
    });
  } catch (error) {
    console.error('Crear usuario error:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
};

export const reactivarUsuario = async (req, res) => {
  try {
    const { id } = req.params;

    const usuario = await prisma.usuario.update({
      where: { id: parseInt(id) },
      data: { activo: true }
    });

    res.json({ message: 'Usuario reactivado correctamente', usuario });
  } catch (error) {
    console.error('Reactivar error:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
};

export const desactivarUsuario = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.usuario.update({
      where: { id: parseInt(id) },
      data: { activo: false }
    });
    res.json({ message: 'Usuario desactivado correctamente' });
  } catch (error) {
    console.error('Desactivar error:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
};

export const listarUsuarios = async (req, res) => {
  try {
    const usuarios = await prisma.usuario.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, dni: true, nombre: true, apellido: true, email: true, celular: true, rol: true, creditos: true, activo: true, createdAt: true }
    });
    res.json(usuarios);
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

export const actualizarCreditos = async (req, res) => {
  try {
    const { id } = req.params;
    const { creditos, observacion } = req.body;

    const usuario = await prisma.usuario.update({
      where: { id: parseInt(id) },
      data: { creditos: parseInt(creditos) }
    });

    res.json({ message: 'Créditos actualizados', usuario: { id: usuario.id, creditos: usuario.creditos } });
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

export const actualizarPerfil = async (req, res) => {
  try {
    const { nombre, apellido, email, celular } = req.body;

    const usuario = await prisma.usuario.update({
      where: { id: req.user.id },
      data: { nombre, apellido, email, celular }
    });

    res.json({ message: 'Perfil actualizado', usuario: { id: usuario.id, nombre: usuario.nombre, apellido: usuario.apellido, email: usuario.email, celular: usuario.celular } });
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

export const cambiarPassword = async (req, res) => {
  try {
    const { passwordActual, passwordNuevo } = req.body;
    const bcrypt = await import('bcryptjs');

    const usuario = await prisma.usuario.findUnique({ where: { id: req.user.id } });
    const valid = await bcrypt.default.compare(passwordActual, usuario.password_hash);
    if (!valid) return res.status(400).json({ error: 'Contraseña actual incorrecta' });

    const hash = await bcrypt.default.hash(passwordNuevo, 10);
    await prisma.usuario.update({
      where: { id: req.user.id },
      data: { password_hash: hash, requiereCambioPassword: false }
    });

    res.json({ message: 'Contraseña actualizada correctamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};
