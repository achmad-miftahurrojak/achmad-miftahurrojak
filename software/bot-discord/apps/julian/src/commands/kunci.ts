import { ChatInputCommandInteraction, SlashCommandBuilder, TextChannel, PermissionFlagsBits, Colors } from 'discord.js';
import { aturKunci, kunciServer, kirimLog } from '../modules/lockdown';

export const data = new SlashCommandBuilder()
  .setName('kunci')
  .setDescription('Kunci channel ini, member tidak bisa nulis')
  .addBooleanOption(option => 
    option.setName('semua')
      .setDescription('Kunci SEMUA channel teks, bukan cuma yang ini')
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

    const berubah = await aturKunci(channel, guild, true);
    await interaction.followUp(berubah ? 'Channel ini dikunci. Buka lagi pakai `/buka`.' : 'Channel ini memang sudah kekunci.');
    
    if (berubah) {
      await kirimLog(guild, 'Channel dikunci', `${channel} dikunci ${interaction.user}`, Colors.Red);
    }
    return;
  }

  const kena = await kunciServer(guild, `manual oleh ${interaction.user.tag}`);
  await interaction.followUp(`${kena.length} channel dikunci. Buka semua pakai \`/buka semua:True\`.`);
}
