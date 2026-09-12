import { ChatInputCommandInteraction, SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, Message } from 'discord.js';
import { CHANNELS, logger } from '@hamin/utils';

export default {
  name: 'pengumuman',
  description: 'Kirim pengumuman ke channel announcement',
  data: new SlashCommandBuilder()
    .setName('pengumuman')
    .setDescription('Kirim pengumuman ke channel announcement')
    .addStringOption(option =>
      option.setName('judul')
        .setDescription('Judul pengumuman')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('isi')
        .setDescription('Isi pengumumannya')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  executeSlash: async (interaction: ChatInputCommandInteraction) => {
    const judul = interaction.options.getString('judul', true);
    const isi = interaction.options.getString('isi', true);

    const channelId = process.env.JULIAN_CHANNEL_PENGUMUMAN_ID || CHANNELS.announcements;
    if (!channelId) {
      await interaction.reply({ content: 'Channel pengumuman belum diisi di kode (JULIAN_CHANNEL_PENGUMUMAN_ID).', ephemeral: true });
      return;
    }

    const channel = interaction.guild?.channels.cache.get(channelId) as import('discord.js').TextChannel;
    if (!channel) {
      await interaction.reply({ content: 'Channel pengumumannya ga ketemu di server ini.', ephemeral: true });
      return;
    }

    // Replace literal '\n' string to actual newline character for formatting
    const formattedIsi = isi.replace(/\\n/g, '\n');

    const embed = new EmbedBuilder()
      .setTitle(judul)
      .setDescription(formattedIsi)
      .setColor(0xFFD700) // Gold
      .setFooter({ text: `Dari ${interaction.user.displayName}` })
      .setTimestamp();

    try {
      await channel.send({ embeds: [embed] });
      await interaction.reply({ content: 'Pengumuman terkirim.', ephemeral: true });

      // Kirim log
      const logChannelId = process.env.LOG_CHANNEL_ID || CHANNELS.logServer;
      const logCh = interaction.guild?.channels.cache.get(logChannelId) as import('discord.js').TextChannel;
      if (logCh) {
        const logEmbed = new EmbedBuilder()
          .setTitle('📣 Pengumuman dikirim')
          .setDescription(`${interaction.user.toString()} ngirim: **${judul}**`)
          .setColor(0xFFD700);
        await logCh.send({ embeds: [logEmbed] }).catch(() => {});
      }
    } catch (error) {
      logger.error(error, '[pengumuman] Gagal mengirim pengumuman');
      await interaction.reply({ content: 'Gagal kirim pengumuman. Pastikan bot punya izin ke channel tersebut.', ephemeral: true });
    }
  },

  executePrefix: async (message: Message, args: string[]) => {
    await message.reply('Gunakan command slash `/pengumuman` untuk ngirim pengumuman biar lebih rapi.');
  }
};
