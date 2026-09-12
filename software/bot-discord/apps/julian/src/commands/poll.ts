import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, Colors } from 'discord.js';

const HURUF_POLL = ['🇦', '🇧', '🇨', '🇩', '🇪'];

export const data = new SlashCommandBuilder()
  .setName('poll')
  .setDescription('Bikin polling')
  .addStringOption(o => o.setName('pertanyaan').setDescription('Yang mau ditanyain').setRequired(true))
  .addStringOption(o => o.setName('pilihan').setDescription('Pisahin pakai | — contoh: Bakso | Mie ayam | Sate').setRequired(true))
  .addIntegerOption(o =>
    o.setName('jam').setDescription('Berapa jam pollingnya dibuka (1-168)').setRequired(false)
      .setMinValue(1).setMaxValue(168)
  );

export async function executeSlash(interaction: ChatInputCommandInteraction) {
  const pertanyaan = interaction.options.getString('pertanyaan', true);
  const pilihanRaw = interaction.options.getString('pilihan', true);
  const jam = interaction.options.getInteger('jam') ?? 24;

  const isi = pilihanRaw.split('|').map(p => p.trim()).filter(p => p.length > 0);

  if (isi.length < 2) {
    await interaction.reply({
      content: 'Minimal dua pilihan, dipisah pakai `|`.\nContoh: `Bakso | Mie ayam | Sate`',
      ephemeral: true
    });
    return;
  }

  if (isi.length > 5) {
    await interaction.reply({ content: 'Maksimal lima pilihan.', ephemeral: true });
    return;
  }

  const tutupTs = Math.floor(Date.now() / 1000) + jam * 3600;
  const baris = isi.map((teks, i) => `${HURUF_POLL[i]}  ${teks}`).join('\n');

  const embed = new EmbedBuilder()
    .setTitle(pertanyaan.slice(0, 300))
    .setDescription(baris)
    .setColor(Colors.Blurple)
    .setFooter({ text: `Dibikin ${interaction.user.displayName}` })
    .addFields({ name: 'Ditutup', value: `<t:${tutupTs}:R>` });

  await interaction.reply({ embeds: [embed] });

  const pesan = await interaction.fetchReply();
  for (let i = 0; i < isi.length; i++) {
    try {
      await pesan.react(HURUF_POLL[i]);
    } catch {
      // ignore
    }
  }
}
