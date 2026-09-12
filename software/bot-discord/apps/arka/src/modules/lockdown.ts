import { Guild, TextChannel, Colors, EmbedBuilder } from 'discord.js';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '@hamin/utils';

const LOCKDOWN_FILE = path.join(process.cwd(), 'data', 'channel-terkunci.json');

// Pastikan direktori data ada
if (!fs.existsSync(path.dirname(LOCKDOWN_FILE))) {
  fs.mkdirSync(path.dirname(LOCKDOWN_FILE), { recursive: true });
}

export async function aturKunci(channel: TextChannel, guild: Guild, kunci: boolean): Promise<boolean> {
  const everyoneRole = guild.roles.everyone;
  const permissions = channel.permissionOverwrites.cache.get(everyoneRole.id);

  const currentSendMessages = permissions ? permissions.deny.has('SendMessages') : false;
  
  if (kunci && currentSendMessages) return false;
  if (!kunci && !currentSendMessages) return false;

  try {
    await channel.permissionOverwrites.edit(everyoneRole, {
      SendMessages: !kunci ? null : false,
    }, { reason: kunci ? 'Lockdown' : 'Buka lockdown' });
    return true;
  } catch (error) {
    logger.error(error, `Gagal set permission untuk channel ${channel.id}`);
    return false;
  }
}

export async function kunciServer(guild: Guild, alasan: string): Promise<string[]> {
  const kena: string[] = [];
  
  const channels = guild.channels.cache.filter(c => c.isTextBased() && !c.isThread());
  
  for (const [id, channel] of channels) {
    try {
      if (await aturKunci(channel as TextChannel, guild, true)) {
        kena.push(id);
      }
    } catch (e) {
      logger.error(e, `[raid] gagal ngunci ${channel.name}`);
    }
  }

  if (kena.length > 0) {
    const data = {
      guild: guild.id,
      channel: kena,
      kapan: new Date().toISOString(),
      alasan
    };
    fs.writeFileSync(LOCKDOWN_FILE, JSON.stringify(data, null, 2));
  }
  
  logger.info(`[raid] ${kena.length} channel dikunci (${alasan})`);
  return kena;
}

export async function bukaServer(guild: Guild, alasan: string): Promise<number> {
  let daftar: string[] = [];
  try {
    if (fs.existsSync(LOCKDOWN_FILE)) {
      const isi = JSON.parse(fs.readFileSync(LOCKDOWN_FILE, 'utf8'));
      daftar = isi.channel || [];
    }
  } catch (e) {
    logger.error(e, 'Gagal baca file lockdown');
  }

  let jumlah = 0;
  for (const ch_id of daftar) {
    const channel = guild.channels.cache.get(ch_id);
    if (!channel || !channel.isTextBased() || channel.isThread()) continue;
    
    try {
      if (await aturKunci(channel as TextChannel, guild, false)) {
        jumlah++;
      }
    } catch (e) {
      logger.error(e, `[raid] gagal ngebuka ${channel.name}`);
    }
  }
  
  try {
    fs.writeFileSync(LOCKDOWN_FILE, JSON.stringify({}, null, 2));
  } catch (e) {}

  logger.info(`[raid] ${jumlah} channel dibuka (${alasan})`);
  return jumlah;
}

export async function kirimLog(guild: Guild, title: string, desc: string, color: number) {
  const logChannelId = process.env.LOG_CHANNEL_ID;
  if (!logChannelId) return;

  const channel = guild.channels.cache.get(logChannelId) as TextChannel;
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setColor(color)
    .setDescription(desc)
    .setTimestamp();

  await channel.send({ embeds: [embed] }).catch(() => {});
}
