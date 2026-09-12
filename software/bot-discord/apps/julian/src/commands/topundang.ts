import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, Colors } from 'discord.js';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '@hamin/utils';


export const data = new SlashCommandBuilder()
  .setName('topundang')
  .setDescription('Lihat leaderboard sipaling banyak ngundang member');

export async function executeSlash(interaction: ChatInputCommandInteraction) {
  const guildId = interaction.guildId;
  if (!guildId) return;

  const undanganPath = path.join(process.cwd(), '../../data/undangan.json');
  let guildData: Record<string, { total: number, riwayat: string[] }> = {};

  try {
    if (fs.existsSync(undanganPath)) {
      const fileData = fs.readFileSync(undanganPath, 'utf8');
      const data = JSON.parse(fileData);
      guildData = data[guildId] || {};
    }
  } catch (err) {
    logger.error(err, '[topundang] gagal baca undangan.json');
  }

  if (Object.keys(guildData).length === 0) {
    await interaction.reply({ content: 'Belum ada catatan undangan di server ini.', ephemeral: true });
    return;
  }

  // Sort by total invites descending
  const sorted = Object.entries(guildData)
    .filter(([_, info]) => (info.total || 0) > 0)
    .sort((a, b) => (b[1].total || 0) - (a[1].total || 0))
    .slice(0, 10);

  if (sorted.length === 0) {
    await interaction.reply({ content: 'Belum ada yang berhasil ngajak masuk.', ephemeral: true });
    return;
  }

  const baris = [];
  let i = 1;
  for (const [uid, info] of sorted) {
    const total = info.total || 0;
    try {
      const anggota = await interaction.guild?.members.fetch(uid).catch(() => null);
      const nama = anggota ? (anggota.displayName || anggota.user.username) : 'Member keluar';
      baris.push(`**${i}.** ${nama} — ${total} orang`);
      i++;
    } catch {
      baris.push(`**${i}.** Member keluar — ${total} orang`);
      i++;
    }
  }

  const embed = new EmbedBuilder()
    .setTitle('📨  Papan Peringkat Undangan')
    .setDescription(baris.join('\n'))
    .setColor(Colors.Gold);

  await interaction.reply({ embeds: [embed] });
}

export async function executePrefix() {
  // Not implemented for prefix
}
