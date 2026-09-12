import { Command } from '../handler';
import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, Colors, TextChannel } from 'discord.js';
import * as fs from 'fs';
import * as path from 'path';
import { CHANNELS, logger } from '@hamin/utils';

const TEMPBAN_FILE = path.join(process.cwd(), 'data', 'tempban.json');

interface TempBanEntry {
  userId: string;
  guildId: string;
  moderator: string;
  reason: string;
  sampai: string;
}

function loadTempbans(): TempBanEntry[] {
  try {
    if (!fs.existsSync(path.dirname(TEMPBAN_FILE))) fs.mkdirSync(path.dirname(TEMPBAN_FILE), { recursive: true });
    if (!fs.existsSync(TEMPBAN_FILE)) return [];
    return JSON.parse(fs.readFileSync(TEMPBAN_FILE, 'utf-8'));
  } catch { return []; }
}

function saveTempbans(data: TempBanEntry[]) {
  fs.writeFileSync(TEMPBAN_FILE, JSON.stringify(data, null, 2));
}

const DURATION_PATTERNS: Record<string, number> = {
  m: 60, jam: 3600, h: 3600, d: 86400, hari: 86400,
};

function parseDuration(input: string): number | null {
  const match = input.match(/^(\d+)\s*(m|jam|h|hari|d)$/);
  if (!match) return null;
  const num = parseInt(match[1]);
  const unit = match[2];
  const multiplier = DURATION_PATTERNS[unit];
  if (!multiplier) return null;
  return num * multiplier * 1000;
}

export async function cekTempban(client: any) {
  const bans = loadTempbans();
  const now = Date.now();
  const sisa: TempBanEntry[] = [];
  for (const b of bans) {
    const sampai = new Date(b.sampai).getTime();
    if (sampai <= now) {
      try {
        const guild = client.guilds.cache.get(b.guildId);
        if (guild) await guild.bans.remove(b.userId, 'Tempban otomatis berakhir');
      } catch { /* skip */ }
    } else {
      sisa.push(b);
    }
  }
  saveTempbans(sisa);
}

const command: Command = {
  name: 'tempban',
  description: 'Ban sementara member dari server',
  data: new SlashCommandBuilder()
    .setName('tempban')
    .setDescription('Ban sementara member dari server')
    .addUserOption(option =>
      option.setName('member')
        .setDescription('Member yang mau di-tempban')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('durasi')
        .setDescription('Contoh: 30m, 2jam, 7hari')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('alasan')
        .setDescription('Alasan tempban')
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  executeSlash: async (interaction) => {
    const targetUser = interaction.options.getUser('member', true);
    const durasiInput = interaction.options.getString('durasi', true);
    const reason = interaction.options.getString('alasan') || 'Ga ada alasan';
    const ms = parseDuration(durasiInput);

    if (!ms) {
      await interaction.reply({ content: 'Format durasi salah. Contoh: `30m`, `2jam`, `7hari`', ephemeral: true });
      return;
    }

    if (ms < 60000) {
      await interaction.reply({ content: 'Minimal durasi 1 menit.', ephemeral: true });
      return;
    }

    if (ms > 30 * 86400000) {
      await interaction.reply({ content: 'Maksimal durasi 30 hari. Pake /ban permanen ya.', ephemeral: true });
      return;
    }

    const member = interaction.guild?.members.cache.get(targetUser.id);
    if (member && !member.bannable) {
      await interaction.reply({ content: 'Bot ga punya izin buat ban member ini.', ephemeral: true });
      return;
    }

    try {
      await interaction.guild?.bans.create(targetUser.id, { reason: `[Tempban] ${reason}` });
      const sampai = new Date(Date.now() + ms);
      const entry: TempBanEntry = {
        userId: targetUser.id,
        guildId: interaction.guildId!,
        moderator: interaction.user.id,
        reason,
        sampai: sampai.toISOString(),
      };
      const bans = loadTempbans();
      bans.push(entry);
      saveTempbans(bans);

      const embed = new EmbedBuilder()
        .setTitle('🔨 Tempban')
        .setColor(Colors.Red)
        .setDescription(`${targetUser.tag} di-tempban.`)
        .addFields(
          { name: 'Alasan', value: reason },
          { name: 'Durasi', value: durasiInput },
          { name: 'Berakhir', value: `<t:${Math.floor(sampai.getTime() / 1000)}:F>` }
        )
        .setTimestamp()
        .setFooter({ text: `Oleh ${interaction.user.tag}` });

      await interaction.reply({ embeds: [embed] });

      const logCh = interaction.guild?.channels.cache.get(process.env.LOG_CHANNEL_ID || CHANNELS.logServer) as TextChannel;
      if (logCh) await logCh.send({ embeds: [embed] }).catch(() => {});

      setTimeout(async () => {
        try {
          await interaction.guild?.bans.remove(targetUser.id, 'Tempban otomatis berakhir');
          const sisaBans = loadTempbans().filter(b => b.userId !== targetUser.id);
          saveTempbans(sisaBans);
          const unbanEmbed = new EmbedBuilder()
            .setTitle('✅ Tempban Berakhir')
            .setColor(Colors.Green)
            .setDescription(`${targetUser.tag} otomatis di-unban.`)
            .setTimestamp();
          if (logCh) await logCh.send({ embeds: [unbanEmbed] }).catch(() => {});
        } catch { /* user might already be gone */ }
      }, ms);
    } catch (error) {
      logger.error(error, '[tempban] gagal ban');
      await interaction.reply({ content: 'Gagal ngeban member ini. Cek posisi role bot.', ephemeral: true });
    }
  }
};

export default command;