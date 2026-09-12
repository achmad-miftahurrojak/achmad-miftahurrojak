import { ChatInputCommandInteraction, SlashCommandBuilder, PermissionFlagsBits, Message } from 'discord.js';
import prisma from '../prisma';

export default {
  name: 'hapuswarn1',
  description: 'Hapus satu peringatan (warn) terbaru dari seorang member',
  data: new SlashCommandBuilder()
    .setName('hapuswarn1')
    .setDescription('Hapus 1 peringatan terbaru milik member')
    .addUserOption(option =>
      option.setName('member')
        .setDescription('Siapa yang mau dihapus 1 warn-nya')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  executeSlash: async (interaction: ChatInputCommandInteraction) => {
    const targetUser = interaction.options.getUser('member', true);

    try {
      // Cari warn terbaru
      const latestWarn = await prisma.warn.findFirst({
        where: { userId: targetUser.id },
        orderBy: { createdAt: 'desc' },
      });

      if (!latestWarn) {
        await interaction.reply({ content: `${targetUser.displayName} ga punya catatan peringatan (warn) yang bisa dihapus.`, ephemeral: true });
        return;
      }

      // Hapus warn tersebut
      await prisma.warn.delete({
        where: { id: latestWarn.id }
      });

      // Hitung sisa warn
      const sisaWarn = await prisma.warn.count({
        where: { userId: targetUser.id }
      });

      await interaction.reply({ 
        content: `Satu catatan peringatan terbaru untuk ${targetUser} berhasil dihapus.\nAlasan warn yang dihapus: *${latestWarn.reason}*\nSisa peringatan saat ini: **${sisaWarn}**.` 
      });

    } catch (error) {
      console.error(error);
      await interaction.reply({ content: 'Terjadi kesalahan saat menghapus data peringatan.', ephemeral: true });
    }
  },

  executePrefix: async (message: Message, args: string[]) => {
    await message.reply('Gunakan command slash `/hapuswarn1` untuk menghapus warn member.');
  }
};
