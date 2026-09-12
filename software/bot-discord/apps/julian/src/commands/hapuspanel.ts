import { ChatInputCommandInteraction, SlashCommandBuilder, PermissionFlagsBits, Message } from 'discord.js';
import { logger } from '@hamin/utils';

export default {
  name: 'hapuspanel',
  description: 'Mematikan panel role dengan menghapus tombol-tombolnya',
  data: new SlashCommandBuilder()
    .setName('hapuspanel')
    .setDescription('Matiin panel role, pesannya tetep ada tapi tombol hilang/mati')
    .addStringOption(option =>
      option.setName('pesan_id')
        .setDescription('ID pesan panelnya')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  executeSlash: async (interaction: ChatInputCommandInteraction) => {
    const pesanId = interaction.options.getString('pesan_id', true).trim();

    if (!/^\d+$/.test(pesanId)) {
      await interaction.reply({ content: 'ID-nya angka doang ya.', ephemeral: true });
      return;
    }

    const channel = interaction.channel as import('discord.js').TextChannel;
    if (!channel) {
      await interaction.reply({ content: 'Gagal menemukan channel.', ephemeral: true });
      return;
    }

    try {
      const message = await channel.messages.fetch(pesanId);
      if (!message) {
        await interaction.reply({ content: 'Ga ada pesan dengan ID itu di channel ini.', ephemeral: true });
        return;
      }

      // Hapus semua tombol (komponen) dari pesan
      await message.edit({ components: [] });
      await interaction.reply({ content: 'Panel dimatiin. Tombol udah dihapus dan ga bisa dipakai lagi.', ephemeral: true });

    } catch (error) {
      logger.error(error, `[hapuspanel] Gagal fetch atau edit pesan ${pesanId}`);
      await interaction.reply({ content: 'Ga bisa nemuin atau ngedit pesan itu. Pastiin ID-nya bener dan pesannya ada di channel ini.', ephemeral: true });
    }
  },

  executePrefix: async (message: Message, args: string[]) => {
    await message.reply('Gunakan command slash `/hapuspanel` untuk mematikan panel role.');
  }
};
