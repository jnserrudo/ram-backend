import { prisma } from '../config/prisma.js';

const entidadPorRuta = {
  '/auth/login': 'USUARIO',
  '/auth/register': 'SOLICITUD',
  '/solicitudes': 'SOLICITUD',
  '/usuarios': 'USUARIO',
  '/clases': 'CLASE',
  '/horarios': 'HORARIO',
  '/reservas': 'RESERVA',
  '/checkin': 'ASISTENCIA',
  '/asistencias': 'ASISTENCIA',
  '/paquetes': 'PAQUETE',
  '/compras': 'COMPRA',
  '/comunicados': 'COMUNICADO',
  '/notificaciones': 'SISTEMA',
};

function detectarEntidad(path) {
  for (const [prefix, entidad] of Object.entries(entidadPorRuta)) {
    if (path.startsWith(prefix)) return entidad;
  }
  return 'SISTEMA';
}

function detectarAccion(method, path) {
  if (path.includes('login')) return 'LOGIN';
  if (path.includes('logout')) return 'LOGOUT';
  if (path.includes('checkin')) return 'CHECKIN';
  if (path.includes('reserv') && method === 'POST') return 'RESERVA';
  if (path.includes('cancel') || (path.includes('reserv') && method === 'DELETE')) return 'CANCELACION';
  if (path.includes('aprobar')) return 'APROBACION';
  if (path.includes('compr')) return 'COMPRA';
  if (method === 'POST') return 'CREATE';
  if (method === 'PUT') return 'UPDATE';
  if (method === 'DELETE') return 'DELETE';
  return 'OTRO';
}

function calcularImpacto(accion, entidad, body) {
  if (['RESERVA', 'CANCELACION', 'CHECKIN', 'COMPRA', 'APROBACION'].includes(accion)) return 'ALTO';
  if (['DELETE', 'UPDATE'].includes(accion)) {
    if (['USUARIO', 'CREDITO', 'RESERVA'].includes(entidad)) return 'ALTO';
    return 'MEDIO';
  }
  if (accion === 'CREATE') return 'BAJO';
  return 'NINGUNO';
}

async function obtenerEstadoAnterior(entidad, id) {
  try {
    switch (entidad) {
      case 'USUARIO':
        return id ? await prisma.usuario.findUnique({ where: { id: parseInt(id) } }) : null;
      case 'CLASE':
        return id ? await prisma.tipoClase.findUnique({ where: { id: parseInt(id) } }) : null;
      case 'HORARIO':
        return id ? await prisma.horario.findUnique({ where: { id: parseInt(id) } }) : null;
      case 'RESERVA':
        return id ? await prisma.reserva.findUnique({ where: { id: parseInt(id) } }) : null;
      case 'ASISTENCIA':
        return id ? await prisma.asistencia.findUnique({ where: { id: parseInt(id) } }) : null;
      case 'PAQUETE':
        return id ? await prisma.paqueteCredito.findUnique({ where: { id: parseInt(id) } }) : null;
      case 'COMUNICADO':
        return id ? await prisma.comunicado.findUnique({ where: { id: parseInt(id) } }) : null;
      default:
        return null;
    }
  } catch {
    return null;
  }
}

export function auditMiddleware() {
  return async (req, res, next) => {
    // Solo auditamos POST, PUT, DELETE. GET no modifica.
    if (!['POST', 'PUT', 'DELETE'].includes(req.method)) {
      return next();
    }

    // No auditamos login directo (capturamos por respuesta)
    const isLogin = req.path.includes('login');

    const entidad = detectarEntidad(req.path);
    const accion = detectarAccion(req.method, req.path);
    const pathId = req.params?.id;

    let estadoAnterior = null;
    if (pathId && ['PUT', 'DELETE'].includes(req.method)) {
      estadoAnterior = await obtenerEstadoAnterior(entidad, pathId);
    }

    // Guardar referencia original de res.json para interceptar respuesta
    const originalJson = res.json.bind(res);

    res.json = function(data) {
      // Restaurar json original
      res.json = originalJson;

      // Crear log de auditoría después de que la respuesta se procesa
      setImmediate(async () => {
        try {
          const impacto = calcularImpacto(accion, entidad, req.body);
          const observacion = construirObservacion(req, data, accion, entidad);

          let estadoPosterior = null;
          if (data && (data.id || data.id === 0)) {
            estadoPosterior = { id: data.id, ...data };
          } else if (data && data.data && data.data.id) {
            estadoPosterior = data.data;
          }

          await prisma.auditoria.create({
            data: {
              usuarioId: req.user?.id || null,
              usuarioDni: req.user?.dni || (isLogin && req.body?.dni) || null,
              accion,
              entidad,
              entidadId: pathId || String(data?.id || ''),
              estadoAnterior: estadoAnterior || undefined,
              estadoPosterior: estadoPosterior || undefined,
              impacto,
              observacion,
              ipAddress: req.ip || req.socket?.remoteAddress || null,
              userAgent: req.headers['user-agent'] || null
            }
          });
        } catch (err) {
          console.error('[Auditoria] Error al registrar:', err.message);
        }
      });

      return originalJson(data);
    };

    next();
  };
}

function construirObservacion(req, data, accion, entidad) {
  const userName = req.user?.nombre ? `${req.user.nombre} ${req.user.apellido}` : 'Sistema';
  const entidadNombre = entidad.toLowerCase();

  switch (accion) {
    case 'LOGIN':
      return `Usuario ${req.body?.dni} inició sesión`;
    case 'CREATE':
      return `${userName} creó un nuevo ${entidadNombre}`;
    case 'UPDATE':
      return `${userName} modificó ${entidadNombre} ID ${req.params?.id}`;
    case 'DELETE':
      return `${userName} eliminó ${entidadNombre} ID ${req.params?.id}`;
    case 'RESERVA':
      return `${userName} realizó una reserva`;
    case 'CANCELACION':
      return `${userName} canceló una reserva`;
    case 'CHECKIN':
      return `Check-in registrado para DNI ${req.body?.dni || req.params?.id}`;
    case 'COMPRA':
      return `${userName} registró una compra de créditos`;
    case 'APROBACION':
      return `${userName} aprobó una solicitud de inscripción`;
    default:
      return `${userName} ejecutó ${accion} sobre ${entidadNombre}`;
  }
}
