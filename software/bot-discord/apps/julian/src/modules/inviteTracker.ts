import { Client, Guild, GuildMember } from 'discord.js';
import { logger } from '@hamin/utils';
import * as fs from 'fs';
import * as path from 'path';

// In-memory invite cache: guildId -> { code -> uses }
const inviteCache: Record<string, Record<string, number>> = {};

export async function refreshInvites(guild: Guild) {
  try {
    const invites = await guild.invites.fetch();
    inviteCache[guild.id] = Object.fromEntries(invites.map(i => [i.code, i.uses ?? 0]));
  } catch {
    logger.warn('[undangan] bot ga punya izin Manage Server, pelacakan mati');
  }
}

export async function findInviter(member: GuildMember): Promise<{ code: string; inviter: string | null; uses: number } | null> {
  const lama = inviteCache[member.guild.id] ?? {};

  let sekarang;
  try {
    sekarang = await member.guild.invites.fetch();
  } catch {
    return null;
  }

  let ketemu: { code: string; inviter: string | null; uses: number } | null = null;

  for (const invite of sekarang.values()) {
    const lamaPakai = lama[invite.code] ?? 0;
    if ((invite.uses ?? 0) > lamaPakai) {
      ketemu = {
        code: invite.code,
        inviter: invite.inviter?.id ?? null,
        uses: invite.uses ?? 0,
      };
      break;
    }
  }

  // Update cache
  inviteCache[member.guild.id] = Object.fromEntries(sekarang.map(i => [i.code, i.uses ?? 0]));
  return ketemu;
}

export function initInviteCache(client: Client) {
  client.guilds.cache.forEach(guild => {
    refreshInvites(guild).catch(() => {});
  });
}

// ── Persistent Invite Tracking ──

const undanganPath = path.join(process.cwd(), '../../data/undangan.json');

function bacaUndangan(): Record<string, Record<string, { total: number, riwayat: string[] }>> {
  try {
    if (fs.existsSync(undanganPath)) {
      const data = fs.readFileSync(undanganPath, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    logger.error(err, '[undangan] gagal baca undangan.json');
  }
  return {};
}

function tulisUndangan(data: Record<string, Record<string, { total: number, riwayat: string[] }>>) {
  try {
    fs.mkdirSync(path.dirname(undanganPath), { recursive: true });
    fs.writeFileSync(undanganPath, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    logger.error(err, '[undangan] gagal tulis undangan.json');
  }
}

export function recordInvite(guildId: string, inviterId: string, invitedUserId: string) {
  const data = bacaUndangan();
  if (!data[guildId]) data[guildId] = {};
  if (!data[guildId][inviterId]) data[guildId][inviterId] = { total: 0, riwayat: [] };
  
  const riwayat = data[guildId][inviterId].riwayat;
  if (!riwayat.includes(invitedUserId)) {
    riwayat.push(invitedUserId);
  }
  data[guildId][inviterId].total = riwayat.length;
  
  tulisUndangan(data);
}

