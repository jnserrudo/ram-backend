import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Limpiar todo
  await prisma.auditoria.deleteMany();
  await prisma.whatsAppLog.deleteMany();
  await prisma.notificacion.deleteMany();
  await prisma.asistencia.deleteMany();
  await prisma.reserva.deleteMany();
  await prisma.compraCredito.deleteMany();
  await prisma.paqueteCredito.deleteMany();
  await prisma.comunicado.deleteMany();
  await prisma.horario.deleteMany();
  await prisma.tipoClase.deleteMany();
  await prisma.solicitudInscripcion.deleteMany();
  await prisma.usuario.deleteMany();

  // Crear admin
  const adminPass = await bcrypt.hash('admin123', 10);
  const admin = await prisma.usuario.create({
    data: {
      dni: '12345678',
      nombre: 'Admin',
      apellido: 'RAM',
      email: 'admin@ramperformance.com',
      celular: '1111111111',
      password_hash: adminPass,
      rol: 'ADMIN',
      creditos: 0,
      requiereCambioPassword: false
    }
  });

  // Crear usuarios de prueba
  const user1Pass = await bcrypt.hash('123456', 10);
  const user1 = await prisma.usuario.create({
    data: {
      dni: '23456789',
      nombre: 'Juan',
      apellido: 'Pérez',
      email: 'juan@test.com',
      celular: '2222222222',
      password_hash: user1Pass,
      rol: 'USER',
      creditos: 12,
      requiereCambioPassword: false
    }
  });

  const user2Pass = await bcrypt.hash('123456', 10);
  const user2 = await prisma.usuario.create({
    data: {
      dni: '34567890',
      nombre: 'María',
      apellido: 'Gómez',
      email: 'maria@test.com',
      celular: '3333333333',
      password_hash: user2Pass,
      rol: 'USER',
      creditos: 5,
      requiereCambioPassword: false
    }
  });

  const user3Pass = await bcrypt.hash('123456', 10);
  const user3 = await prisma.usuario.create({
    data: {
      dni: '45678901',
      nombre: 'Carlos',
      apellido: 'López',
      email: 'carlos@test.com',
      celular: '4444444444',
      password_hash: user3Pass,
      rol: 'USER',
      creditos: 0,
      requiereCambioPassword: false
    }
  });

  // Crear tipos de clase
  const musculacion = await prisma.tipoClase.create({
    data: { titulo: 'Musculación', descripcion: 'Entrenamiento de fuerza y resistencia muscular' }
  });

  const funcional = await prisma.tipoClase.create({
    data: { titulo: 'Funcional', descripcion: 'Ejercicios funcionales de alta intensidad' }
  });

  // Crear paquetes de créditos
  const paquete12 = await prisma.paqueteCredito.create({
    data: { titulo: 'Pack Mensual', descripcion: '12 clases para todo el mes', cantidadCreditos: 12, precio: 25000, duracionDias: 30, esClaseIndividual: false }
  });

  const paquete20 = await prisma.paqueteCredito.create({
    data: { titulo: 'Pack Full', descripcion: '20 clases para entrenar al máximo', cantidadCreditos: 20, precio: 35000, duracionDias: 30, esClaseIndividual: false }
  });

  // Crear compras para alinear créditos iniciales con nuevo sistema
  const fechaInicio = new Date();
  const fechaVence = new Date();
  fechaVence.setDate(fechaVence.getDate() + 30);
  fechaVence.setHours(23, 59, 59, 999);

  await prisma.compraCredito.create({
    data: {
      usuarioId: user1.id,
      paqueteId: paquete12.id,
      creditosOtorgados: 12,
      creditosConsumidos: 0,
      totalPagado: 25000,
      metodoPago: 'Efectivo',
      fechaInicio,
      fechaVencimiento: fechaVence,
      estado: 'ACTIVO'
    }
  });

  await prisma.compraCredito.create({
    data: {
      usuarioId: user2.id,
      paqueteId: paquete12.id,
      creditosOtorgados: 12,
      creditosConsumidos: 7,
      totalPagado: 25000,
      metodoPago: 'Efectivo',
      fechaInicio,
      fechaVencimiento: fechaVence,
      estado: 'ACTIVO'
    }
  });

  // Crear horarios (Lunes a Sábado)
  const dias = [1, 2, 3, 4, 5, 6]; // Lunes a Sábado
  const horariosData = [];

  dias.forEach(dia => {
    // Mañana
    [7, 8, 9, 10].forEach(hora => {
      horariosData.push({
        tipoClaseId: musculacion.id,
        diaSemana: dia,
        horaInicio: hora,
        bloque: 'MANANA',
        cupoMaximo: 12
      });
    });

    // Tarde
    [13, 14, 15, 16, 17].forEach(hora => {
      horariosData.push({
        tipoClaseId: funcional.id,
        diaSemana: dia,
        horaInicio: hora,
        bloque: 'TARDE',
        cupoMaximo: 12
      });
    });

    // Noche
    [18, 19, 20, 21].forEach(hora => {
      horariosData.push({
        tipoClaseId: musculacion.id,
        diaSemana: dia,
        horaInicio: hora,
        bloque: 'NOCHE',
        cupoMaximo: 12
      });
    });
  });

  await prisma.horario.createMany({ data: horariosData });

  const todosHorarios = await prisma.horario.findMany();

  // Crear reservas de prueba
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const manana = new Date(hoy);
  manana.setDate(manana.getDate() + 1);

  await prisma.reserva.create({
    data: {
      usuarioId: user1.id,
      horarioId: todosHorarios.find(h => h.diaSemana === hoy.getDay() && h.horaInicio === 19)?.id || todosHorarios[0].id,
      fecha: hoy,
      estado: 'RESERVADA'
    }
  });

  await prisma.reserva.create({
    data: {
      usuarioId: user2.id,
      horarioId: todosHorarios.find(h => h.diaSemana === manana.getDay() && h.horaInicio === 9)?.id || todosHorarios[1].id,
      fecha: manana,
      estado: 'RESERVADA'
    }
  });

  // Crear comunicado
  await prisma.comunicado.create({
    data: {
      adminId: admin.id,
      titulo: 'Horario de Feriado',
      mensaje: 'El próximo feriado el gimnasio abrirá solo en el turno de la mañana.',
      activo: true
    }
  });

  // Crear logs de auditoría de ejemplo
  await prisma.auditoria.createMany({
    data: [
      {
        usuarioId: admin.id,
        usuarioDni: '12345678',
        accion: 'CREATE',
        entidad: 'USUARIO',
        entidadId: String(user1.id),
        estadoPosterior: { id: user1.id, nombre: user1.nombre, creditos: 12 },
        impacto: 'ALTO',
        observacion: 'Admin RAM creó un nuevo usuario',
        ipAddress: '127.0.0.1'
      },
      {
        usuarioId: admin.id,
        usuarioDni: '12345678',
        accion: 'UPDATE',
        entidad: 'CREDITO',
        entidadId: String(user2.id),
        estadoAnterior: { creditos: 0 },
        estadoPosterior: { creditos: 5 },
        impacto: 'ALTO',
        observacion: 'Admin RAM modificó créditos de usuario ID 2',
        ipAddress: '127.0.0.1'
      },
      {
        usuarioId: user1.id,
        usuarioDni: user1.dni,
        accion: 'RESERVA',
        entidad: 'RESERVA',
        entidadId: '1',
        impacto: 'ALTO',
        observacion: 'Juan Pérez realizó una reserva',
        ipAddress: '127.0.0.1'
      }
    ]
  });

  console.log('Seed completado exitosamente');
  console.log('Admin: DNI 12345678 / pass: admin123');
  console.log('Usuarios: DNI 23456789, 34567890, 45678901 / pass: 123456');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
