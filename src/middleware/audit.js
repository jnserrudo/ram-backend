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
  if (path.includes('creditos')) return 'CREDITOS';
  if (path.includes('reactivar')) return 'REACTIVAR';
  if (path.includes('desactivar')) return 'DESACTIVAR';
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
  if (['RESERVA', 'CANCELACION', 'CHECKIN', 'COMPRA', 'APROBACION', 'CREDITOS', 'REACTIVAR', 'DESACTIVAR'].includes(accion)) return 'ALTO';
  if (['DELETE', 'UPDATE'].includes(accion)) {
    if (['USUARIO', 'CLASE', 'HORARIO'].includes(entidad)) return 'ALTO';
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
          const observacion = construirObservacion(req, data, accion, entidad, estadoAnterior);

          let estadoPosterior = null;
          if (data) {
            if (data.id !== undefined) estadoPosterior = data;
            else if (data.usuario?.id !== undefined) estadoPosterior = data.usuario;
            else if (data.clase?.id !== undefined) estadoPosterior = data.clase;
            else if (data.reserva?.id !== undefined) estadoPosterior = data.reserva;
            else if (data.asistencia?.id !== undefined) estadoPosterior = data.asistencia;
            else if (data.data?.id !== undefined) estadoPosterior = data.data;
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

function construirObservacion(req, data, accion, entidad, estadoAnterior) {
  const userName = req.user?.nombre ? `${req.user.nombre} ${req.user.apellido}` : 'Sistema';
  const entidadNombre = entidad.toLowerCase();
  const body = req.body || {};

  switch (accion) {
    case 'LOGIN':
      return `Inicio de sesión: DNI ${body.dni}`;
    case 'CREDITOS':
      const prev = estadoAnterior?.creditos || 0;
      const actual = body.creditos || body.cantidad || 0;
      const diff = actual - prev;
      const accionPalabra = diff >= 0 ? 'Aumentó' : 'Disminuyó';
      return `${userName} ${accionPalabra.toLowerCase()} créditos de ${estadoAnterior?.nombre || 'usuario'} (ID ${req.params?.id}): de ${prev} a ${actual} (${diff >= 0 ? '+' : ''}${diff})`;
    case 'REACTIVAR':
      return `${userName} reactivó al usuario ${estadoAnterior?.nombre || ''} (ID ${req.params?.id})`;
    case 'DESACTIVAR':
      return `${userName} desactivó al usuario ${estadoAnterior?.nombre || ''} (ID ${req.params?.id})`;
    case 'APROBACION':
      return `${userName} aprobó solicitud ID ${req.params?.id}. Nuevo Usuario: ${data?.usuario?.nombre || ''}`;
    case 'CHECKIN':
      return `Check-in: ${body.dni || req.params?.id} registró asistencia`;
    case 'RESERVA':
      const esEspera = data?.estado === 'EN_ESPERA' || data?.reserva?.estado === 'EN_ESPERA';
      return `${userName} reservó turno ${esEspera ? '(En Lista de Espera)' : '(Confirmado)'}`;
    case 'CANCELACION':
      return `${userName} canceló una reserva`;
    case 'COMPRA':
      return `${userName} registró compra: ${body.metodoPago || 'Efectivo'}`;
    case 'CREATE':
      const detalle = body.nombre || body.titulo || body.email || '';
      return `${userName} creó ${entidadNombre} ${detalle ? `(${detalle})` : ''}`;
    case 'UPDATE':
      const modif = Object.keys(body).filter(k => k !== 'password' && k !== 'password_hash' && k !== 'token').join(', ');
      return `${userName} modificó ${entidadNombre} ID ${req.params?.id}. Cambios en: ${modif || 'ninguno'}`;
    case 'DELETE':
      return `${userName} eliminó ${entidadNombre} ID ${req.params?.id}`;
    default:
      return `${userName} ejecutó ${accion} sobre ${entidadNombre}`;
  }
}
