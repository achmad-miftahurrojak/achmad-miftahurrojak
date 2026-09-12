import { ChatInputCommandInteraction, SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, Colors, Message } from 'discord.js';
import { CHANNELS, logger } from '@hamin/utils';

export default {
  name: 'unban',
  description: 'Membuka blokir (unban) member',
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Buka blokir member dari server')
    .addStringOption(option =>
      option.setName('user_id')
        .setDescription('Discord ID dari user yang mau di-unban')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('alasan')
        .setDescription('Alasan unban')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  executeSlash: async (interaction: ChatInputCommandInteraction) => {
    const userId = interaction.options.getString('user_id', true).trim();
    const alasan = interaction.options.getString('alasan') || 'Tidak ada alasan khusus';

    if (!/^\d+$/.test(userId)) {
      await interaction.reply({ content: 'User ID harus berupa angka.', ephemeral: true });
      return;
    }

    try {
      // Pastikan bot punya akses unban
      await interaction.guild?.members.unban(userId, `Di-unban oleh ${interaction.user.tag}: ${alasan}`);

      await interaction.reply({ content: `✅ Berhasil unban user dengan ID \`${userId}\`.\nAlasan: ${alasan}` });

      // Log ke logServer
      const logChannelId = process.env.LOG_CHANNEL_ID || CHANNELS.logServer;
      const logCh = interaction.guild?.channels.cache.get(logChannelId) as import('discord.js').TextChannel;
      
      if (logCh) {
        const logEmbed = new EmbedBuilder()
          .setTitle('🔓 Member Di-unban')
          .setColor(Colors.Green)
          .setDescription(`User dengan ID \`${userId}\` telah di-unban oleh ${interaction.user.toString()}`)
          .addFields({ name: 'Alasan', value: alasan })
          .setTimestamp();
        
        await logCh.send({ embeds: [logEmbed] }).catch(() => {});
      }

    } catch (error: any) {
      if (error.code === 10026) { // Unknown Ban
        await interaction.reply({ content: `User dengan ID \`${userId}\` tidak ada di daftar ban.`, ephemeral: true });
      } else {
        logger.error(error, `[unban] Gagal unban user ${userId}`);
        await interaction.reply({ content: `Gagal unban. Pastikan ID-nya benar dan bot punya izin unban.\nError: ${error.message}`, ephemeral: true });
      }
    }
  },

  executePrefix: async (message: Message, args: string[]) => {
    await message.reply('Gunakan command slash `/unban` untuk melakukan unban member.');
  }
};
