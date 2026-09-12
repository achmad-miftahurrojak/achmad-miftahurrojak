import { ChatInputCommandInteraction, SlashCommandBuilder, PermissionFlagsBits, TextChannel, EmbedBuilder, Colors } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('slowmode')
  .setDescription('Atur slowmode di channel ini')
  .addIntegerOption(option =>
    option.setName('detik')
      .setDescription('Berapa detik jeda tiap pesan (0 buat matiin)')
      .setRequired(true)
      .setMinValue(0)
      .setMaxValue(21600)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels);

export async function executeSlash(interaction: ChatInputCommandInteraction) {
  const detik = interaction.options.get('detik')?.value as number;
  const channel = interaction.channel as TextChannel;

  if (!channel || channel.isDMBased()) {
    await interaction.reply({ content: 'Command ini cuma bisa dipakai di text channel.', ephemeral: true });
    return;
  }

  try {
    await channel.setRateLimitPerUser(detik, `Diatur oleh ${interaction.user.tag}`);
    
    if (detik > 0) {
      await interaction.reply(`Slowmode nyala: satu pesan tiap ${detik} detik.`);
    } else {
      await interaction.reply('Slowmode dimatiin.');
    }

    // Log to log channel
    const logChannelId = process.env.JULIAN_CHANNEL_LOG_ID;
    if (logChannelId) {
      const logChannel = interaction.guild?.channels.cache.get(logChannelId) as TextChannel;
      if (logChannel) {
        const embed = new EmbedBuilder()
          .setTitle('Slowmode Diubah')
          .setDescription(`${channel.toString()} diset ${detik} detik oleh ${interaction.user.toString()}`)
          .setColor(Colors.DarkGrey)
          .setTimestamp();
        
        await logChannel.send({ embeds: [embed] }).catch(() => {});
      }
    }
  } catch (error) {
    console.error('[slowmode] Error setting rate limit:', error);
    await interaction.reply({ content: 'Gagal ngatur slowmode. Pastikan bot punya izin Manage Channels.', ephemeral: true });
  }
}

export async function executePrefix() {
  // Not implemented for prefix
}
