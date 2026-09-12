import { Command } from '../handler';
import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, Colors } from 'discord.js';

const command: Command = {
  name: 'kick',
  description: 'Keluarkan member dari server',
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Keluarkan member dari server')
    .addUserOption(option => 
      option.setName('member')
        .setDescription('Siapa yang mau dikeluarin')
        .setRequired(true))
    .addStringOption(option => 
      option.setName('alasan')
        .setDescription('Alasannya apa')
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
    
  executeSlash: async (interaction) => {
    const targetMember = interaction.options.getMember('member');
    const reason = interaction.options.getString('alasan') || 'Tidak ada alasan';

    if (!targetMember || !('kick' in targetMember)) {
      await interaction.reply({ content: 'Member tidak ditemukan di server ini.', ephemeral: true });
      return;
    }

    try {
      await targetMember.kick(`${reason} (oleh ${interaction.user.tag})`);

      const embed = new EmbedBuilder()
        .setTitle('👢 Member Dikeluarkan (Kick)')
        .setColor(Colors.Red)
        .setDescription(`${targetMember} telah dikeluarkan dari server.`)
        .addFields({ name: 'Alasan', value: reason })
        .setTimestamp()
        .setFooter({ text: `Oleh ${interaction.user.tag}` });

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error(error);
      await interaction.reply({ content: 'Gagal mengeluarkan member. Pastikan peran bot berada di atas member tersebut.', ephemeral: true });
    }
  }
};

export default command;
