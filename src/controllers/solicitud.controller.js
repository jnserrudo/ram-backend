import bcrypt from 'bcryptjs';
import { prisma } from '../config/prisma.js';
import { enviarWhatsApp } from '../config/whatsapp.js';

export const listarSolicitudes = async (req, res) => {
  try {
    const solicitudes = await prisma.solicitudInscripcion.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(solicitudes);
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

export const aprobarSolicitud = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado, codigoReferido, forzar } = req.body; // APROBADA o RECHAZADA, forzar para duplicados

    const solicitud = await prisma.solicitudInscripcion.findUnique({ where: { id: parseInt(id) } });
    if (!solicitud) return res.status(404).json({ error: 'Solicitud no encontrada' });

    if (estado === 'APROBADA') {
      // Verificar si el usuario ya existe por DNI
      const usuarioExistente = await prisma.usuario.findUnique({
        where: { dni: solicitud.dni }
      });

      if (usuarioExistente && !forzar) {
        return res.status(409).json({ 
          error: 'DNI Duplicado', 
          usuario: {
            id: usuarioExistente.id,
            nombre: usuarioExistente.nombre,
            apellido: usuarioExistente.apellido,
            activo: usuarioExistente.activo
          }
        });
      }

      if (usuarioExistente && forzar) {
        // Caso: El administrador decidió resolver el duplicado
        await prisma.usuario.update({
          where: { id: usuarioExistente.id },
          data: { activo: true } // Lo reactivamos por las dudas
        });

        await prisma.solicitudInscripcion.update({
          where: { id: parseInt(id) },
          data: { estado: 'APROBADA' }
        });

        return res.json({ message: 'Usuario existente reactivado y solicitud aprobada.' });
      }

      const passwordDefault = solicitud.dni;
      const hash = await bcrypt.hash(passwordDefault, 10);

      let referidor = null;
      if (codigoReferido) {
        referidor = await prisma.usuario.findUnique({
          where: { codigoReferido }
        });
      }

      const usuario = await prisma.usuario.create({
        data: {
          dni: solicitud.dni,
          celular: solicitud.celular,
          email: solicitud.email,
          nombre: solicitud.nombre,
          apellido: solicitud.apellido,
          password_hash: hash,
          rol: 'USER',
          creditos: referidor ? 2 : 0,
          requiereCambioPassword: true,
          referidoPor: codigoReferido || null
        }
      });

      if (referidor) {
        await prisma.usuario.update({
          where: { id: referidor.id },
          data: { creditos: { increment: 2 } }
        });

        await prisma.referido.create({
          data: {
            usuarioId: referidor.id,
            referidoDni: usuario.dni,
            referidoNombre: `${usuario.nombre} ${usuario.apellido}`,
            estado: 'COMPLETADO',
            creditosOtorgados: 2
          }
        });

        await enviarWhatsApp({
          usuarioId: referidor.id,
          telefono: referidor.celular,
          tipo: 'SISTEMA',
          mensaje: `¡Felicitaciones! ${usuario.nombre} se registró con tu código de referido. Ambos recibieron 2 clases gratis. 🎉`
        });
      }

      await prisma.solicitudInscripcion.update({
        where: { id: parseInt(id) },
        data: { estado: 'APROBADA' }
      });

      const mensajeBienvenida = referidor
        ? `Hola ${usuario.nombre}, tu solicitud en RAM Performance fue aprobada. ¡Recibiste 2 clases gratis por usar el código de referido! Tu DNI (${usuario.dni}) es tu usuario y contraseña. Ingresá y cambiala por seguridad. Bienvenido!`
        : `Hola ${usuario.nombre}, tu solicitud en RAM Performance fue aprobada. Tu DNI (${usuario.dni}) es tu usuario y contraseña. Ingresá y cambiala por seguridad. Bienvenido!`;

      await enviarWhatsApp({
        usuarioId: usuario.id,
        telefono: usuario.celular,
        tipo: 'APROBACION',
        mensaje: mensajeBienvenida
      });

      res.json({ message: 'Solicitud aprobada. Usuario creado.', usuario });
    } else {
      await prisma.solicitudInscripcion.update({
        where: { id: parseInt(id) },
        data: { estado: 'RECHAZADA' }
      });
      res.json({ message: 'Solicitud rechazada.' });
    }
  } catch (error) {
    console.error('Aprobar error:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
};
