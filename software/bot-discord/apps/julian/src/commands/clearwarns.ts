import { Command } from '../handler';
import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, Colors } from 'discord.js';
import prisma from '../prisma';

const command: Command = {
  name: 'clearwarns',
  description: 'Hapus semua peringatan member',
  data: new SlashCommandBuilder()
    .setName('clearwarns')
    .setDescription('Hapus semua peringatan member')
    .addUserOption(option =>
      option.setName('member')
        .setDescription('Member yang warn-nya mau dihapus')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  executeSlash: async (interaction) => {
    const targetUser = interaction.options.getUser('member');

    if (!targetUser) {
      await interaction.reply({ content: 'Member tidak ditemukan.', ephemeral: true });
      return;
    }

    const deleted = await prisma.warn.deleteMany({
      where: { userId: targetUser.id }
    });

    const embed = new EmbedBuilder()
      .setTitle('🗑️ Peringatan Dihapus')
      .setColor(Colors.Green)
      .setDescription(`Berhasil menghapus **${deleted.count}** peringatan untuk ${targetUser}.`)
      .setTimestamp()
      .setFooter({ text: `Oleh ${interaction.user.tag}` });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
};

export default command;