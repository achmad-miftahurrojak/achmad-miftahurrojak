import { CommandInteraction, SlashCommandBuilder, EmbedBuilder, Colors, PermissionFlagsBits } from 'discord.js';
import { AUTOMOD_CONFIG } from '../modules/automod';

export const data = new SlashCommandBuilder()
  .setName('automod')
  .setDescription('Lihat setelan automod yang sedang aktif')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function executeSlash(interaction: CommandInteraction) {
  const baris = [
    `Status: **${AUTOMOD_CONFIG.AKTIF ? 'nyala' : 'mati'}**`,
    `Filter kata: ${AUTOMOD_CONFIG.FILTER_KATA ? 'nyala' : 'mati'} (${AUTOMOD_CONFIG.KATA_BERAT.length} berat + ${AUTOMOD_CONFIG.KATA_RINGAN.length} ringan)`,
    `Blokir undangan: ${AUTOMOD_CONFIG.BLOKIR_UNDANGAN ? 'nyala' : 'mati'}`,
    AUTOMOD_CONFIG.ANTI_SPAM ? `Anti spam: ${AUTOMOD_CONFIG.SPAM_JUMLAH} pesan / ${AUTOMOD_CONFIG.SPAM_DETIK} detik` : 'Anti spam: mati',
    AUTOMOD_CONFIG.BATAS_KAPITAL ? `Batas kapital: ${AUTOMOD_CONFIG.KAPITAL_PERSEN}%` : 'Batas kapital: mati',
    `Maks mention: ${AUTOMOD_CONFIG.MAX_MENTION} orang`,
    AUTOMOD_CONFIG.AUTO_SLOWMODE ? `Slowmode otomatis: ${AUTOMOD_CONFIG.SLOWMODE_DETIK} detik kalau ${AUTOMOD_CONFIG.SLOWMODE_PEMICU} spam dari ${AUTOMOD_CONFIG.SLOWMODE_ORANG_BEDA}+ orang dalam ${AUTOMOD_CONFIG.SLOWMODE_JENDELA} detik` : 'Slowmode otomatis: mati',
    `Timeout otomatis: setelah ${AUTOMOD_CONFIG.STRIKE_SEBELUM_TIMEOUT} pelanggaran, selama ${AUTOMOD_CONFIG.TIMEOUT_OTOMATIS_MENIT} menit`,
    `Channel bebas: ${AUTOMOD_CONFIG.BEBAS_CHANNELS.length}`
  ];

  const embed = new EmbedBuilder()
    .setTitle('Setelan Automod')
    .setDescription(baris.join('\n'))
    .setColor(Colors.Orange)
    .setFooter({ text: 'Admin dan moderator kebal automod' });

  await interaction.reply({ embeds: [embed], ephemeral: true });
}
