import { Command } from '../handler';
import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, Colors } from 'discord.js';

const command: Command = {
  name: 'timeout',
  description: 'Bisukan member sementara',
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Bisukan member sementara')
    .addUserOption(option => 
      option.setName('member')
        .setDescription('Siapa yang mau dibisukan')
        .setRequired(true))
    .addIntegerOption(option => 
      option.setName('menit')
        .setDescription('Berapa menit (maks 40320 atau 28 hari)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(40320))
    .addStringOption(option => 
      option.setName('alasan')
        .setDescription('Alasannya apa')
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    
  executeSlash: async (interaction) => {
    const targetMember = interaction.options.getMember('member');
    const minutes = interaction.options.getInteger('menit') || 1;
    const reason = interaction.options.getString('alasan') || 'Tidak ada alasan';

    if (!targetMember || !('timeout' in targetMember)) {
      await interaction.reply({ content: 'Member tidak ditemukan di server ini.', ephemeral: true });
      return;
    }

    try {
      // 1 minute = 60,000 milliseconds
      await targetMember.timeout(minutes * 60 * 1000, reason);

      const embed = new EmbedBuilder()
        .setTitle('🔇 Timeout Diberikan')
        .setColor(Colors.Orange)
        .setDescription(`${targetMember} telah dibisukan selama ${minutes} menit.`)
        .addFields({ name: 'Alasan', value: reason })
        .setTimestamp()
        .setFooter({ text: `Oleh ${interaction.user.tag}` });

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error(error);
      await interaction.reply({ content: 'Gagal membisukan member. Pastikan peran bot berada di atas member tersebut.', ephemeral: true });
    }
  }
};

export default command;
