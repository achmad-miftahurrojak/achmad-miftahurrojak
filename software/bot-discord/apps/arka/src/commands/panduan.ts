import { SlashCommandBuilder, ChatInputCommandInteraction, Message, EmbedBuilder } from 'discord.js';
import { Command } from '../handler';
import { WARNA } from '../config';
import { PANDUAN } from '../data/panduanData';
import { diArena } from '../gameCore';

export const panduanCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('panduan')
    .setDescription('Cara main game di channel ini gimana?') as SlashCommandBuilder,

  executeSlash: async (interaction: ChatInputCommandInteraction) => {
    if (!(await diArena(interaction))) return;
    const isiChannel = PANDUAN[interaction.channelId];
    if (!isiChannel) {
    const daftar = Object.entries(PANDUAN).map(([chId, p]) => `<#${chId}> — ${p[0]}`);
    const isi = new EmbedBuilder()
      .setColor(WARNA)
      .setTitle('🌊  Channel ini ga ada gamenya')
      .setDescription(
        'Tiap game punya channel sendiri. Masuk ke salah satu terus ketik `/panduan` lagi.\n\n' + daftar.join('\n')
      );
    await interaction.reply({ embeds: [isi], ephemeral: true });
    return;
  }
  const [judul, keterangan, cara] = isiChannel;
    const isi = new EmbedBuilder().setColor(WARNA).setTitle(judul).setDescription(keterangan);
    isi.addFields({
      name: 'Cara mainnya',
      value: cara.map((b, i) => `**${i + 1}.** ${b}`).join('\n'),
      inline: false
    });
    isi.setFooter({ text: 'XP dari semua game masuk ke papan peringkat yang sama' });
    await interaction.reply({ embeds: [isi] });
  }
};
