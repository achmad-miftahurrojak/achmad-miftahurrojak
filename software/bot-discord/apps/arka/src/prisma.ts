import { PrismaClient } from '@hamin/database';

// Singleton Prisma instance untuk seluruh Arka bot.
// Semua file di apps/arka harus import dari sini, bukan new PrismaClient() sendiri.
const prisma = new PrismaClient();

export default prisma;
