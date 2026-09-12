import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, GuildMember } from 'discord.js';
import prisma from '../prisma';
const AKUN_BARU_HARI = 7;

export const data = new SlashCommandBuilder()
  .setName('userinfo')
  .setDescription('Liat info lengkap seorang member')
  .addUserOption(o => o.setName('member').setDescription('Siapa yang mau diliat (opsional)').setRequired(false));

export async function executeSlash(interaction: ChatInputCommandInteraction) {
  const target = interaction.options.getMember('member') as GuildMember | null ?? interaction.member as GuildMember;

  const now = Date.now();
  const createdAt = target.user.createdAt;
  const joinedAt = target.joinedAt;
  const umurAkun = Math.floor((now - createdAt.getTime()) / 86400000);
  const lamaGabung = joinedAt ? Math.floor((now - joinedAt.getTime()) / 86400000) : null;

  const embed = new EmbedBuilder()
    .setTitle(target.displayName)
    .setDescription(`${target.toString()} • \`${target.id}\``)
    .setColor(target.displayColor || 0x5865f2)
    .setThumbnail(target.displayAvatarURL())
    .setTimestamp()
    .addFields(
      { name: 'Akun dibikin', value: `<t:${Math.floor(createdAt.getTime() / 1000)}:D>\n${umurAkun} hari lalu`, inline: true }
    );

  if (joinedAt) {
    embed.addFields({ name: 'Gabung server', value: `<t:${Math.floor(joinedAt.getTime() / 1000)}:D>\n${lamaGabung} hari lalu`, inline: true });
  }

  if (umurAkun < AKUN_BARU_HARI) {
    embed.addFields({ name: '⚠️ Perhatian', value: `Akun baru, umurnya di bawah ${AKUN_BARU_HARI} hari`, inline: false });
  }

  const roles = [...target.roles.cache.values()]
    .filter(r => r.name !== '@everyone')
    .reverse()
    .slice(0, 15)
    .map(r => r.toString());

  embed.addFields({ name: `Role (${target.roles.cache.size - 1})`, value: roles.join(' ') || 'ga punya role', inline: false });

  // Catatan warn
  const warns = await prisma.warn.findMany({ where: { userId: target.id } });
  const status: string[] = [];
  if (warns.length) status.push(`${warns.length} peringatan`);
  if (target.isCommunicationDisabled()) {
    const until = target.communicationDisabledUntil;
    if (until) status.push(`lagi dibisukan sampai <t:${Math.floor(until.getTime() / 1000)}:R>`);
  }
  if (target.user.bot) status.push('ini aplikasi, bukan orang');

  embed.addFields({ name: 'Catatan', value: status.join('\n') || 'bersih, ga ada apa apa', inline: false });

  await interaction.reply({ embeds: [embed] });
}
