import { Command } from '../handler';
import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, Colors } from 'discord.js';
import prisma from '../prisma';

const EXPIRY_DAYS = 30;

const command: Command = {
  name: 'warn',
  description: 'Beri peringatan ke member',
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Beri peringatan ke member')
    .addUserOption(option => 
      option.setName('member')
        .setDescription('Siapa yang mau di-warn')
        .setRequired(true))
    .addStringOption(option => 
      option.setName('alasan')
        .setDescription('Alasannya apa')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    
  executeSlash: async (interaction) => {
    const targetUser = interaction.options.getUser('member');
    const reason = interaction.options.getString('alasan') || 'Tidak ada alasan';

    if (!targetUser) {
      await interaction.reply({ content: 'Member tidak ditemukan.', ephemeral: true });
      return;
    }

    try {
      const expiresAt = new Date(Date.now() + EXPIRY_DAYS * 24 * 60 * 60 * 1000);
      await prisma.warn.create({
        data: {
          userId: targetUser.id,
          moderator: interaction.user.id,
          reason: reason,
          expiresAt,
        }
      });

      const warnCount = await prisma.warn.count({
        where: { userId: targetUser.id }
      });

      const embed = new EmbedBuilder()
        .setTitle('⚠️ Peringatan Diberikan')
        .setColor(Colors.Yellow)
        .setDescription(`${targetUser} telah diberi peringatan.`)
        .addFields(
          { name: 'Alasan', value: reason },
          { name: 'Total Warn', value: warnCount.toString(), inline: true },
          { name: 'Kadaluwarsa', value: `<t:${Math.floor(expiresAt.getTime() / 1000)}:R>`, inline: true }
        )
        .setTimestamp()
        .setFooter({ text: `Oleh ${interaction.user.tag}` });

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error(error);
      await interaction.reply({ content: 'Terjadi kesalahan saat menyimpan data peringatan.', ephemeral: true });
    }
  }
};

export default command;
