import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const u = await prisma.usuario.findUnique({ where: { dni: '12345678' } });
console.log(u ? 'FOUND: ' + u.nombre + ' role=' + u.rol + ' active=' + u.activo + ' hash=' + u.password_hash?.slice(0, 20) : 'NOT FOUND');
await prisma.$disconnect();
