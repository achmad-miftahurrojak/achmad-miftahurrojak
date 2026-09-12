import { ChatInputCommandInteraction, SlashCommandBuilder, PermissionFlagsBits, TextChannel } from 'discord.js';
import { logger } from '@hamin/utils';

const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID || '';

export const data = new SlashCommandBuilder()
  .setName('say')
  .setDescription('Bikin bot ngomong di channel ini')
  .addStringOption(o => o.setName('teks').setDescription('Yang mau diomongin').setRequired(true))
  .addChannelOption(o => o.setName('channel').setDescription('Kirim ke channel lain (opsional)').setRequired(false))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function executeSlash(interaction: ChatInputCommandInteraction) {
  const teks = interaction.options.getString('teks', true);
  const targetChannel = (interaction.options.getChannel('channel') ?? interaction.channel) as TextChannel;

  try {
    await targetChannel.send(teks.replace(/\\n/g, '\n'));
  } catch {
    await interaction.reply({ content: `Ga punya izin kirim ke ${targetChannel}.`, ephemeral: true });
    return;
  }

  await interaction.reply({ content: `Terkirim ke ${targetChannel}.`, ephemeral: true });

  if (LOG_CHANNEL_ID) {
    const logChannel = interaction.guild?.channels.cache.get(LOG_CHANNEL_ID) as TextChannel | undefined;
    if (logChannel) {
      await logChannel.send({ content: `📢 ${interaction.user} disuruh bot ngomong di ${targetChannel}\n\n${teks.slice(0, 500)}` }).catch(() => {});
    }
  }
}
