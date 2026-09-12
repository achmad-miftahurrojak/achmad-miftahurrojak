import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, Colors } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('serverinfo')
  .setDescription('Ringkasan server ini');

export async function executeSlash(interaction: ChatInputCommandInteraction) {
  const guild = interaction.guild!;

  await guild.members.fetch();

  const manusia = guild.members.cache.filter(m => !m.user.bot).size;
  const aplikasi = guild.memberCount - manusia;

  const embed = new EmbedBuilder()
    .setTitle(guild.name)
    .setDescription(guild.description ?? '')
    .setColor(Colors.Blurple)
    .setTimestamp()
    .setFooter({ text: `ID: ${guild.id}` })
    .addFields(
      { name: 'Member', value: `${manusia} orang\n${aplikasi} aplikasi`, inline: true },
      { name: 'Channel', value: `${guild.channels.cache.filter(c => c.isTextBased()).size} teks\n${guild.channels.cache.filter(c => c.isVoiceBased()).size} voice`, inline: true },
      { name: 'Role', value: `${guild.roles.cache.size - 1}`, inline: true },
      { name: 'Dibikin', value: `<t:${Math.floor(guild.createdAt.getTime() / 1000)}:D>`, inline: true },
      { name: 'Boost', value: `Level ${guild.premiumTier}\n${guild.premiumSubscriptionCount} boost`, inline: true },
      { name: 'Pemilik', value: guild.ownerId ? `<@${guild.ownerId}>` : 'ga kebaca', inline: true }
    );

  if (guild.iconURL()) embed.setThumbnail(guild.iconURL()!);

  if (guild.afkChannel) {
    embed.addFields({
      name: 'Channel AFK',
      value: `${guild.afkChannel.toString()} (setelah ${guild.afkTimeout / 60} menit)`,
      inline: false
    });
  }

  await interaction.reply({ embeds: [embed] });
}
