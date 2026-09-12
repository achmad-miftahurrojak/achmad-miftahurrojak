import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, TextChannel } from 'discord.js';

const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID || '';

export const data = new SlashCommandBuilder()
  .setName('embed')
  .setDescription('Kirim pesan kotak rapi pakai muka bot')
  .addStringOption(o => o.setName('judul').setDescription('Judulnya').setRequired(true))
  .addStringOption(o => o.setName('isi').setDescription('Isinya, pakai \\n buat ganti baris').setRequired(true))
  .addStringOption(o => o.setName('warna').setDescription('Kode hex, misal 4AA8D8').setRequired(false))
  .addChannelOption(o => o.setName('channel').setDescription('Kirim ke channel lain (opsional)').setRequired(false))
  .addStringOption(o => o.setName('gambar').setDescription('Link gambar (opsional)').setRequired(false))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function executeSlash(interaction: ChatInputCommandInteraction) {
  const judul = interaction.options.getString('judul', true);
  const isi = interaction.options.getString('isi', true);
  const warnaStr = interaction.options.getString('warna') ?? '4AA8D8';
  const gambar = interaction.options.getString('gambar') ?? '';
  const targetChannel = (interaction.options.getChannel('channel') ?? interaction.channel) as TextChannel;

  let warnaNilai: number;
  try {
    warnaNilai = parseInt(warnaStr.replace('#', ''), 16);
    if (isNaN(warnaNilai)) throw new Error();
  } catch {
    await interaction.reply({ content: 'Warnanya ditulis hex, misal `4AA8D8`.', ephemeral: true });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle(judul)
    .setDescription(isi.replace(/\\n/g, '\n'))
    .setColor(warnaNilai);

  if (gambar.startsWith('http')) {
    embed.setImage(gambar);
  }

  try {
    await targetChannel.send({ embeds: [embed] });
  } catch {
    await interaction.reply({ content: `Ga punya izin kirim ke ${targetChannel}.`, ephemeral: true });
    return;
  }

  await interaction.reply({ content: `Terkirim ke ${targetChannel}.`, ephemeral: true });

  if (LOG_CHANNEL_ID) {
    const logChannel = interaction.guild?.channels.cache.get(LOG_CHANNEL_ID) as TextChannel | undefined;
    if (logChannel) {
      await logChannel.send({ content: `📋 ${interaction.user} ngirim embed di ${targetChannel}\nJudul: ${judul}` }).catch(() => {});
    }
  }
}
