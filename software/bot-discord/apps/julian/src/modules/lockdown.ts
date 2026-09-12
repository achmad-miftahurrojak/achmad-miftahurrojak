import { Guild, TextChannel, Colors, EmbedBuilder, Client, GuildMember } from 'discord.js';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '@hamin/utils';

const LOCKDOWN_FILE = path.join(process.cwd(), 'data', 'channel-terkunci.json');

// Pastikan direktori data ada
if (!fs.existsSync(path.dirname(LOCKDOWN_FILE))) {
  fs.mkdirSync(path.dirname(LOCKDOWN_FILE), { recursive: true });
}

// ─── Raid Detection ─────────────────────────────────────────

const RAID_JOIN_AMBANG = 5;
const RAID_JENDELA_DETIK = 60;
const RAID_BUKA_MENIT = 10;
const joinAntri = new Map<string, number[]>();
let raidAktif = false;

export function deteksiRaid(member: GuildMember) {
  if (raidAktif) return;
  const sekarang = Date.now();
  let jejak = joinAntri.get(member.guild.id) || [];
  jejak = jejak.filter(t => sekarang - t < RAID_JENDELA_DETIK * 1000);
  jejak.push(sekarang);
  joinAntri.set(member.guild.id, jejak);
  if (jejak.length >= RAID_JOIN_AMBANG) {
    raidAktif = true;
    return true;
  }
  return false;
}

export async function tanganiRaid(guild: Guild, client: Client) {
  const kena = await kunciServer(guild, 'Raid terdeteksi');
  await kirimLog(guild, '🚨 RAID TERDETEKSI!', `${kena.length} channel dikunci otomatis.\n${RAID_JOIN_AMBANG}+ member gabung dalam ${RAID_JENDELA_DETIK} detik.\nServer dibuka otomatis ${RAID_BUKA_MENIT} menit lagi.`, Colors.Red);
  logger.warn(`[raid] TERDETEKSI! ${kena.length} channel dikunci di ${guild.name}`);
  setTimeout(async () => {
    const jml = await bukaServer(guild, 'Auto-unlock setelah raid');
    await kirimLog(guild, '✅ Server dibuka otomatis', `${jml} channel dibuka setelah ${RAID_BUKA_MENIT} menit lockdown.`, Colors.Green);
    raidAktif = false;
    joinAntri.delete(guild.id);
  }, RAID_BUKA_MENIT * 60 * 1000);
}

// ─── Anti-Nuke Detection ─────────────────────────────────────

const NUKE_DELETE_AMBANG = 3;
const NUKE_JENDELA_DETIK = 30;
const hapusAntri = new Map<string, number[]>();

export function deteksiNuke(key: string) {
  const sekarang = Date.now();
  let jejak = hapusAntri.get(key) || [];
  jejak = jejak.filter(t => sekarang - t < NUKE_JENDELA_DETIK * 1000);
  jejak.push(sekarang);
  hapusAntri.set(key, jejak);
  return jejak.length >= NUKE_DELETE_AMBANG;
}

export async function tanganiNuke(guild: Guild, client: Client, tipe: string) {
  await kirimLog(guild, '☢️ ANTI-NUKE TERPICU!', `Terlalu banyak ${tipe} dihapus dalam ${NUKE_JENDELA_DETIK} detik.\nSemua role dengan izin Administrator dicabut otomatis.`, Colors.DarkRed);
  const admins = guild.roles.cache.filter(r => r.permissions.has('Administrator') && r.name !== '@everyone');
  for (const role of admins.values()) {
    try {
      await role.setPermissions(role.permissions.remove('Administrator'), 'Anti-nuke: cabut Admin');
    } catch { /* skip */ }
  }
  await kunciServer(guild, `Anti-nuke: ${tipe} massal`);
  logger.warn(`[nuke] ANTI-NUKE: ${tipe} massal di ${guild.name}, role Admin dicabut`);
}

// ─── Existing lockdown functions ─────────────────────────────

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
