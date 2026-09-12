import { Command } from '../handler';
import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, Colors } from 'discord.js';
import prisma from '../prisma';

const command: Command = {
  name: 'warnings',
  description: 'Lihat riwayat peringatan member',
  data: new SlashCommandBuilder()
    .setName('warnings')
    .setDescription('Lihat riwayat peringatan member')
    .addUserOption(option =>
      option.setName('member')
        .setDescription('Member yang riwayat warn-nya mau dilihat')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  executeSlash: async (interaction) => {
    const targetUser = interaction.options.getUser('member');

    if (!targetUser) {
      await interaction.reply({ content: 'Member tidak ditemukan.', ephemeral: true });
      return;
    }

    const warns = await prisma.warn.findMany({
      where: { 
        userId: targetUser.id,
        OR: [
          { expiresAt: null },
          { expiresAt: { gte: new Date() } }
        ]
      },
      orderBy: { createdAt: 'desc' },
      take: 25,
    });

    if (warns.length === 0) {
      await interaction.reply({ content: `${targetUser} tidak memiliki peringatan aktif.`, ephemeral: true });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(`⚠️ Peringatan Aktif — ${targetUser.tag}`)
      .setColor(Colors.Yellow)
      .setThumbnail(targetUser.displayAvatarURL())
      .addFields(
        { name: 'Total Warn Aktif', value: `${warns.length}`, inline: true }
      )
      .setFooter({ text: 'Kadaluwarsa otomatis 30 hari' })
      .setTimestamp();

    warns.forEach((w, i) => {
      const moderator = interaction.guild?.members.cache.get(w.moderator)?.user?.tag ?? `Unknown (${w.moderator})`;
      const expireText = w.expiresAt ? `<t:${Math.floor(w.expiresAt.getTime() / 1000)}:R>` : 'Tidak ada batas';
      embed.addFields({
        name: `#${i + 1} — ${w.createdAt.toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}`,
        value: `**Oleh:** ${moderator}\n**Alasan:** ${w.reason}\n**Kadaluwarsa:** ${expireText}`,
        inline: false,
      });
    });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
};

export default command;