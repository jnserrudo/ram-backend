import bcrypt from 'bcryptjs';
import { signToken } from '../config/jwt.js';
import { prisma } from '../config/prisma.js';
import { enviarWhatsApp } from '../config/whatsapp.js';

export const login = async (req, res) => {
  try {
    const { dni, password } = req.body;

    const usuario = await prisma.usuario.findUnique({ where: { dni } });
    if (!usuario) {
      return res.status(401).json({ error: 'DNI o contraseña incorrectos' });
    }

    if (!usuario.activo) {
      return res.status(403).json({ error: 'Tu cuenta está inactiva. Contactá a recepción para reactivarla y seguir entrenando.' });
    }

    const valid = await bcrypt.compare(password, usuario.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'DNI o contraseña incorrectos' });
    }

    const token = signToken({ id: usuario.id, dni: usuario.dni, rol: usuario.rol, nombre: usuario.nombre, apellido: usuario.apellido });

    res.json({
      token,
      user: {
        id: usuario.id,
        dni: usuario.dni,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        rol: usuario.rol,
        creditos: usuario.creditos,
        requiereCambioPassword: usuario.requiereCambioPassword
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
};

export const me = async (req, res) => {
  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id: req.user.id },
      select: { id: true, dni: true, nombre: true, apellido: true, email: true, celular: true, rol: true, creditos: true, activo: true, requiereCambioPassword: true }
    });
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(usuario);
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

export const register = async (req, res) => {
  try {
    const { nombre, apellido, dni, celular, email } = req.body;

    const existe = await prisma.usuario.findUnique({ where: { dni } });
    if (existe) {
      return res.status(400).json({ error: 'Ya existe un usuario con ese DNI' });
    }

    const existeEmail = await prisma.usuario.findFirst({ where: { email } });
    if (existeEmail) {
      return res.status(400).json({ error: 'Ya existe un usuario con ese email' });
    }

    const solicitud = await prisma.solicitudInscripcion.create({
      data: { nombre, apellido, dni, celular, email }
    });

    res.status(201).json({ message: 'Solicitud enviada. Pronto te contactaremos.', solicitud });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
};
