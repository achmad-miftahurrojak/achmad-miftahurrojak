import { ChatInputCommandInteraction, SlashCommandBuilder, TextChannel, PermissionFlagsBits, Colors } from 'discord.js';
import { aturKunci, bukaServer, kirimLog } from '../modules/lockdown';

export const data = new SlashCommandBuilder()
  .setName('buka')
  .setDescription('Buka kunci channel')
  .addBooleanOption(option => 
    option.setName('semua')
      .setDescription('Buka SEMUA channel yang tadi dikunci')
      .setRequired(false)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels);

export async function executeSlash(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  
  const guild = interaction.guild;
  if (!guild) {
    await interaction.followUp('Command ini hanya bisa digunakan di server.');
    return;
  }

  const semua = interaction.options.getBoolean('semua');

  if (!semua) {
    const channel = interaction.channel as TextChannel;
    if (!channel) return;

    const berubah = await aturKunci(channel, guild, false);
    await interaction.followUp(berubah ? 'Channel ini dibuka.' : 'Channel ini memang tidak kekunci.');
    
    if (berubah) {
      await kirimLog(guild, 'Channel dibuka', `${channel} dibuka ${interaction.user}`, Colors.Green);
    }
    return;
  }

  const jumlah = await bukaServer(guild, `manual oleh ${interaction.user.tag}`);
  await interaction.followUp(`${jumlah} channel dibuka lagi.`);
}
