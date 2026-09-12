import { PrismaClient } from '@hamin/database';
import { logger } from '@hamin/utils';

const prisma = new PrismaClient();
const PROFIL_EXPIRY_HARI = 90;

export function startProfileCleanupTask() {
  // Jalankan pembersihan pertama kali setelah 10 detik bot startup
  setTimeout(() => {
    runCleanup().catch(e => logger.error(e, '[cleanup] Gagal menjalankan pembersihan awal'));
  }, 10_000);

  // Jalankan setiap 24 jam sekali
  setInterval(async () => {
    try {
      await runCleanup();
    } catch (e) {
      logger.error(e, '[cleanup] Gagal menjalankan pembersihan berkala');
    }
  }, 24 * 60 * 60 * 1000);

  logger.info('[cleanup] Task pembersihan profil tidak aktif dimulai (24 jam sekali)');
}

async function runCleanup() {
  const batasTanggal = new Date();
  batasTanggal.setDate(batasTanggal.getDate() - PROFIL_EXPIRY_HARI);

  const { count } = await prisma.dirgaProfile.deleteMany({
    where: {
      updatedAt: {
        lt: batasTanggal
      }
    }
  });

  if (count > 0) {
    logger.info(`[cleanup] Menghapus ${count} profil user yang tidak aktif selama ${PROFIL_EXPIRY_HARI} hari`);
  }
}
