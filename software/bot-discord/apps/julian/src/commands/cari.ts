import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, Colors } from 'discord.js';
import prisma from '../prisma';
const KATEGORI = ['Beasiswa', 'Lowongan', 'Kuliah', 'Tutorial', 'Lainnya'];

export const data = new SlashCommandBuilder()
  .setName('cari')
  .setDescription('Cari link yang pernah disimpen')
  .addStringOption(o => o.setName('kata').setDescription('Kata kunci, boleh judul atau kategori').setRequired(true));

export async function executeSlash(interaction: ChatInputCommandInteraction) {
  const kata = interaction.options.getString('kata', true);
  const kunci = kata.toLowerCase();

  const semua = await prisma.resource.findMany({ orderBy: { id: 'desc' } });
  const hasil = semua.filter(d =>
    d.judul.toLowerCase().includes(kunci) ||
    d.kategori.toLowerCase().includes(kunci) ||
    (d.catatan ?? '').toLowerCase().includes(kunci)
  );

  if (!hasil.length) {
    await interaction.reply({ content: `Ga nemu apa apa buat '${kata}'.`, ephemeral: true });
    return;
  }

  const tampil = hasil.slice(0, 8);
  const baris = tampil.map(d => `**#${d.id} ${d.judul}**\n${d.link}\n${d.kategori} • ${d.oleh}`);

  const embed = new EmbedBuilder()
    .setTitle(`Hasil cari: ${kata}`)
    .setDescription(baris.join('\n\n'))
    .setColor(0x1ABC9C)
    .setFooter({ text: `${hasil.length} ketemu, ditampilin ${tampil.length} terbaru` });

  await interaction.reply({ embeds: [embed] });
}
