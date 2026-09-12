import { prisma } from '../index';
import { AiMessage } from './ai';

const RIWAYAT_PANJANG = 14;
const RIWAYAT_UMUR_JAM = 72;

export async function getHistory(channelId: string): Promise<AiMessage[]> {
  const cutoff = new Date(Date.now() - RIWAYAT_UMUR_JAM * 60 * 60 * 1000);
  
  const rows = await prisma.dirgaHistory.findMany({
    where: { userId: channelId, createdAt: { gte: cutoff } },
    orderBy: { createdAt: 'asc' },
    take: RIWAYAT_PANJANG,
  });

  return rows.map(r => ({
    role: r.role as 'user' | 'model',
    parts: [{ text: r.content }]
  }));
}

export async function addToHistory(channelId: string, role: 'user' | 'model', content: string) {
  await prisma.dirgaHistory.create({
    data: { userId: channelId, role, content }
  });
}

export async function clearHistory(channelId: string) {
  await prisma.dirgaHistory.deleteMany({ where: { userId: channelId } });
}
