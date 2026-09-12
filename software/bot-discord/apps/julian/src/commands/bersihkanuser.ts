import { ChatInputCommandInteraction, SlashCommandBuilder, PermissionFlagsBits, TextChannel, EmbedBuilder, Colors } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('bersihkanuser')
  .setDescription('Hapus pesan dari satu orang aja')
  .addUserOption(option =>
    option.setName('member')
      .setDescription('Pesan siapa yang mau dihapus')
      .setRequired(true)
  )
  .addIntegerOption(option =>
    option.setName('jumlah')
      .setDescription('Dicari dalam berapa pesan terakhir (1-200)')
      .setRequired(false)
      .setMinValue(1)
      .setMaxValue(200)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);

export async function executeSlash(interaction: ChatInputCommandInteraction) {
  const member = interaction.options.getUser('member', true);
  const jumlah = (interaction.options.get('jumlah')?.value as number) || 100;
  const channel = interaction.channel as TextChannel;

  if (!channel || channel.isDMBased()) {
    await interaction.reply({ content: 'Command ini cuma bisa dipakai di text channel.', ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const messages = await channel.messages.fetch({ limit: jumlah });
    const userMessages = messages.filter(m => m.author.id === member.id);
    
    let deletedCount = 0;
    if (userMessages.size > 0) {
      const deleted = await channel.bulkDelete(userMessages, true);
      deletedCount = deleted.size;
    }

    await interaction.followUp({ content: `${deletedCount} pesan punya ${member.displayName || member.username} kehapus (dari ${jumlah} pesan terakhir).`, ephemeral: true });

    // Log to log channel
    const logChannelId = process.env.JULIAN_CHANNEL_LOG_ID;
    if (logChannelId) {
      const logChannel = interaction.guild?.channels.cache.get(logChannelId) as TextChannel;
      if (logChannel) {
        const embed = new EmbedBuilder()
          .setTitle('Pesan user dibersihkan')
          .setDescription(`${deletedCount} pesan ${member.toString()} dihapus di ${channel.toString()} oleh ${interaction.user.toString()}`)
          .setColor(Colors.DarkGrey)
          .setTimestamp();
        
        await logChannel.send({ embeds: [embed] }).catch(() => {});
      }
    }
  } catch (error) {
    console.error('[bersihkanuser] Error deleting messages:', error);
    await interaction.followUp({ content: 'Gagal hapus pesan. Pastikan bot punya izin Manage Messages dan pesan belum terlalu lama (lebih dari 14 hari).', ephemeral: true });
  }
}

export async function executePrefix() {
  // Not implemented for prefix
}
