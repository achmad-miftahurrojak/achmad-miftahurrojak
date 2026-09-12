import { UserContextMenuCommandInteraction, MessageContextMenuCommandInteraction, ContextMenuCommandBuilder, ApplicationCommandType, EmbedBuilder, Colors, TextChannel } from 'discord.js';
import { Collection } from 'discord.js';
import prisma from './prisma';

interface ContextCommand {
  data: ContextMenuCommandBuilder;
  execute: (interaction: UserContextMenuCommandInteraction | MessageContextMenuCommandInteraction) => Promise<void>;
}

export const contextMenus = new Collection<string, ContextCommand>();

// ─── User Info ──────────────────────────────────────────────────

const userInfoData = new ContextMenuCommandBuilder()
  .setName('Info User')
  .setType(ApplicationCommandType.User);

const userInfoExecute = async (interaction: UserContextMenuCommandInteraction | MessageContextMenuCommandInteraction) => {
  if (!interaction.isUserContextMenuCommand()) return;
  const target = interaction.targetUser;
  const member = interaction.guild?.members.cache.get(target.id);

  const embed = new EmbedBuilder()
    .setTitle(`Info ${target.tag}`)
    .setThumbnail(target.displayAvatarURL())
    .setColor(Colors.Blue)
    .addFields(
      { name: 'ID', value: target.id, inline: true },
      { name: 'Bot?', value: target.bot ? 'Iya' : 'Bukan', inline: true },
      { name: 'Dibuat', value: `<t:${Math.floor(target.createdTimestamp / 1000)}:R>`, inline: true }
    );

  if (member) {
    const roleList = member.roles.cache.filter(r => r.name !== '@everyone').map(r => r.toString()).join(', ') || '(tidak ada)';
    embed.addFields(
      { name: 'Nama di server', value: member.displayName, inline: true },
      { name: 'Gabung', value: `<t:${Math.floor((member.joinedAt?.getTime() || 0) / 1000)}:R>`, inline: true },
      { name: `Role (${member.roles.cache.size - 1})`, value: roleList.length > 100 ? roleList.slice(0, 100) + '...' : roleList, inline: false }
    );
  }

  await interaction.reply({ embeds: [embed], ephemeral: true });
};

contextMenus.set('Info User', { data: userInfoData, execute: userInfoExecute });

// ─── Warn User (context) ─────────────────────────────────────────

const warnUserData = new ContextMenuCommandBuilder()
  .setName('Warn User')
  .setType(ApplicationCommandType.User);

const warnUserExecute = async (interaction: UserContextMenuCommandInteraction | MessageContextMenuCommandInteraction) => {
  if (!interaction.isUserContextMenuCommand()) return;
  const target = interaction.targetUser;

  if (!interaction.memberPermissions?.has('ModerateMembers')) {
    await interaction.reply({ content: 'Lo ga punya izin buat warn.', ephemeral: true });
    return;
  }

  await interaction.reply({
    content: `Ketik alasan warn buat **${target.tag}**:`,
    ephemeral: true,
  });

  const filter = (m: any) => m.author.id === interaction.user.id;
  const channel = interaction.channel as TextChannel;
  const collected = await channel?.awaitMessages({ filter, max: 1, time: 30000, errors: ['time'] }).catch(() => null);
  if (!collected || collected.size === 0) {
    await interaction.editReply({ content: 'Waktu habis. Warn dibatalkan.' });
    return;
  }

  const reason = collected.first()?.content || 'Tidak ada alasan';
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await prisma.warn.create({
    data: { userId: target.id, moderator: interaction.user.id, reason, expiresAt }
  });

  const warnCount = await prisma.warn.count({
    where: { userId: target.id, OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }] }
  });

  await interaction.editReply({
    content: null,
    embeds: [new EmbedBuilder()
      .setTitle('⚠️ Peringatan Diberikan')
      .setColor(Colors.Yellow)
      .setDescription(`${target} telah di-warn lewat context menu.`)
      .addFields(
        { name: 'Alasan', value: reason },
        { name: 'Total Warn Aktif', value: warnCount.toString(), inline: true }
      )
      .setTimestamp()
      .setFooter({ text: `Oleh ${interaction.user.tag}` })]
  });
};

contextMenus.set('Warn User', { data: warnUserData, execute: warnUserExecute });

export function getContextMenuData() {
  return [...contextMenus.values()].map(c => c.data.toJSON());
}