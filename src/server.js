import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import { auditMiddleware } from './middleware/audit.js';
import { enviarRecordatorios } from './jobs/recordatorios.job.js';

import authRoutes from './routes/auth.routes.js';
import solicitudRoutes from './routes/solicitud.routes.js';
import usuarioRoutes from './routes/usuario.routes.js';
import claseRoutes from './routes/clase.routes.js';
import horarioRoutes from './routes/horario.routes.js';
import reservaRoutes from './routes/reserva.routes.js';
import checkinRoutes from './routes/checkin.routes.js';
import paqueteRoutes from './routes/paquete.routes.js';
import compraRoutes from './routes/compra.routes.js';
import notificacionRoutes from './routes/notificacion.routes.js';
import comunicadoRoutes from './routes/comunicado.routes.js';
import reporteRoutes from './routes/reporte.routes.js';
import auditoriaRoutes from './routes/auditoria.routes.js';
import asistenciaRoutes from './routes/asistencia.routes.js';
import estadisticasRoutes from './routes/estadisticas.routes.js';
import logrosRoutes from './routes/logros.routes.js';
import referidosRoutes from './routes/referidos.routes.js';
import planesRoutes from './routes/planes.routes.js';
import actividadRoutes from './routes/actividad.routes.js';

import dashboardRoutes from './routes/dashboard.routes.js';

const app = express();
const PORT = process.env.PORT || 3001;

// CORS configuration
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3001',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? allowedOrigins 
    : true, // Allow all in development
  credentials: false
}));

app.use(express.json());
app.use(auditMiddleware());

app.use('/api/auth', authRoutes);
app.use('/api/solicitudes', solicitudRoutes);
app.use('/api/usuarios', usuarioRoutes);
app.use('/api/clases', claseRoutes);
app.use('/api/horarios', horarioRoutes);
app.use('/api/reservas', reservaRoutes);
app.use('/api/checkin', checkinRoutes);
app.use('/api/paquetes', paqueteRoutes);
app.use('/api/compras', compraRoutes);
app.use('/api/notificaciones', notificacionRoutes);
app.use('/api/comunicados', comunicadoRoutes);
app.use('/api/reportes', reporteRoutes);
app.use('/api/auditoria', auditoriaRoutes);
app.use('/api/asistencias', asistenciaRoutes);
app.use('/api/estadisticas', estadisticasRoutes);
app.use('/api/logros', logrosRoutes);
app.use('/api/referidos', referidosRoutes);
app.use('/api/planes', planesRoutes);
app.use('/api/actividad', actividadRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

cron.schedule('0 * * * *', async () => {
  console.log('[Cron] Ejecutando job de recordatorios...');
  await enviarRecordatorios();
});

app.listen(PORT, () => {
  console.log(`RAM Performance API corriendo en http://localhost:${PORT}`);
  console.log('[Cron] Job de recordatorios iniciado (cada hora)');
});
