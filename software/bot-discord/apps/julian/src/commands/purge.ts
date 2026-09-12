import { Command } from '../handler';
import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, Colors, TextChannel } from 'discord.js';

const command: Command = {
  name: 'bersihkan',
  description: 'Hapus pesan massal',
  data: new SlashCommandBuilder()
    .setName('bersihkan')
    .setDescription('Hapus pesan massal')
    .addIntegerOption(option => 
      option.setName('jumlah')
        .setDescription('Berapa pesan yang mau dihapus (maks 100)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
    
  executeSlash: async (interaction) => {
    const amount = interaction.options.getInteger('jumlah');

    if (!amount) {
      await interaction.reply({ content: 'Jumlah tidak valid.', ephemeral: true });
      return;
    }

    if (!(interaction.channel instanceof TextChannel)) {
      await interaction.reply({ content: 'Perintah ini hanya bisa digunakan di Text Channel.', ephemeral: true });
      return;
    }

    try {
      const messages = await interaction.channel.bulkDelete(amount, true);

      const embed = new EmbedBuilder()
        .setTitle('🧹 Pesan Dibersihkan')
        .setColor(Colors.Green)
        .setDescription(`${messages.size} pesan berhasil dihapus.`)
        .setTimestamp()
        .setFooter({ text: `Oleh ${interaction.user.tag}` });

      const reply = await interaction.reply({ embeds: [embed], fetchReply: true });
      
      // Auto delete the notification after 5 seconds
      setTimeout(() => {
        reply.delete().catch(() => {});
      }, 5000);
      
    } catch (error) {
      console.error(error);
      await interaction.reply({ content: 'Gagal menghapus pesan. Pesan yang lebih dari 14 hari tidak bisa dihapus massal.', ephemeral: true });
    }
  }
};

export default command;
