import { prisma } from './src/config/prisma.js';
console.log('Prisma client imported successfully');
prisma.$connect().then(() => {
  console.log('Connected to database');
  prisma.$disconnect().then(() => process.exit(0));
}).catch(err => {
  console.error('Connection error:', err.message);
  process.exit(1);
});
