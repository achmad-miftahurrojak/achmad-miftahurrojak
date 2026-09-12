import { Client, TextChannel } from 'discord.js';
import { PrismaClient } from '@hamin/database';
import { logger } from '@hamin/utils';
import { askAI, AiMessage } from './ai';

// Revive uses its own prisma instance to avoid circular import with index.ts
const prisma = new PrismaClient();

const SEPI_JAM = 10;
const JEDA_REVIVE_JAM = 20;
const REVIVE_JAM_MULAI = 9;
const REVIVE_JAM_SELESAI = 23;

const PEMANTIK_CADANGAN = [
  'eh lo lagi sibuk apa sekarang',
  'kabar lo gimana, lama ga keliatan',
  'udah makan belum lo',
  'lagi nonton apa akhir akhir ini',
  'kalau tiba tiba dapet libur seminggu, lo mau ngapain',
  'ada rekomendasi lagu ga'
];

export function startReviveTask(client: Client) {
  // Check every 30 minutes
  setInterval(async () => {
    try {
      await checkAndRevive(client);
    } catch (e) {
      logger.error(e, '[revive] error in revive task');
    }
  }, 30 * 60 * 1000);

  logger.info('[revive] task started — checks every 30 min');
}

async function checkAndRevive(client: Client) {
  const settings = await prisma.dirgaSettings.findFirst();
  if (!settings?.channelReviveId) return;

  const now = new Date();
  const jamWIB = (now.getUTCHours() + 7) % 24;
  if (jamWIB < REVIVE_JAM_MULAI || jamWIB >= REVIVE_JAM_SELESAI) return;

  if (settings.lastRevive) {
    const diffHours = (now.getTime() - settings.lastRevive.getTime()) / 3_600_000;
    if (diffHours < JEDA_REVIVE_JAM) return;
  }

  const channel = client.channels.cache.get(settings.channelReviveId) as TextChannel | undefined;
  if (!channel) return;

  // Check last non-bot message
  const messages = await channel.messages.fetch({ limit: 50 });
  const lastHuman = messages.find(m => !m.author.bot);

  if (lastHuman) {
    const idleHours = (now.getTime() - lastHuman.createdAt.getTime()) / 3_600_000;
    if (idleHours < SEPI_JAM) return;
  }

  // Pick a random member with the revive role (if configured)
  let targetMention = '';
  if (settings.roleReviveId) {
    const role = channel.guild.roles.cache.get(settings.roleReviveId);
    if (role) {
      const candidates = role.members.filter(m => !m.user.bot && !m.isCommunicationDisabled());
      const target = candidates.random();
      if (target) targetMention = `${target} `;
    }
  }

  // Generate revive text
  const prompt: AiMessage[] = [{
    role: 'user',
    parts: [{ text: 'Grup lagi sepi banget nih udah berjam-jam. Bikin satu kalimat buat mancing orang ngobrol. Bisa nanya sesuatu yang receh, nyindir dikit karena pada tidur, atau ngelempar topik random. Jangan kaku, pake gaya lo biasa. Maksimal 150 huruf.' }]
  }];

  const result = await askAI(prompt);
  const text = result || PEMANTIK_CADANGAN[Math.floor(Math.random() * PEMANTIK_CADANGAN.length)];

  await channel.send(`${targetMention}${text}`);
  logger.info(`[revive] sent revive message`);

  await prisma.dirgaSettings.update({
    where: { id: settings.id },
    data: { lastRevive: now }
  });
}
