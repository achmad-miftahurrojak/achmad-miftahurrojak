import { Command } from '../handler';
import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, Colors } from 'discord.js';

const command: Command = {
  name: 'ban',
  description: 'Blokir member permanen',
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Blokir member permanen')
    .addUserOption(option => 
      option.setName('member')
        .setDescription('Siapa yang mau diblokir')
        .setRequired(true))
    .addStringOption(option => 
      option.setName('alasan')
        .setDescription('Alasannya apa')
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
    
  executeSlash: async (interaction) => {
    const targetMember = interaction.options.getMember('member');
    const targetUser = interaction.options.getUser('member');
    const reason = interaction.options.getString('alasan') || 'Tidak ada alasan';

    if (!targetUser) {
      await interaction.reply({ content: 'Member tidak ditemukan.', ephemeral: true });
      return;
    }

    try {
      if (targetMember && 'ban' in targetMember) {
        await targetMember.ban({ reason: `${reason} (oleh ${interaction.user.tag})` });
      } else {
        await interaction.guild?.members.ban(targetUser, { reason: `${reason} (oleh ${interaction.user.tag})` });
      }

      const embed = new EmbedBuilder()
        .setTitle('🔨 Member Diblokir (Ban)')
        .setColor(Colors.Red)
        .setDescription(`${targetUser} telah diblokir dari server.`)
        .addFields({ name: 'Alasan', value: reason })
        .setTimestamp()
        .setFooter({ text: `Oleh ${interaction.user.tag}` });

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error(error);
      await interaction.reply({ content: 'Gagal memblokir member. Pastikan peran bot berada di atas member tersebut.', ephemeral: true });
    }
  }
};

export default command;
