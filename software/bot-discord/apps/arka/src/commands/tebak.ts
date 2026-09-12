import { SlashCommandBuilder, ChatInputCommandInteraction, Message } from 'discord.js';
import { Command } from '../handler';
import { TEBAK_MAKS, TEBAK_KESEMPATAN } from '../config';
import { suara } from '../data/suara';
import { diArena, beriXp, prisma } from '../gameCore';
import { majuMisi } from './misi';

interface SesiTebak {
  angka: number;
  sisa: number;
}

const sesiTebak = new Map<string, SesiTebak>();

const tebakCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('tebak')
    .setDescription('Tebak angka rahasia Arka, ada petunjuknya')
    .addIntegerOption((o) =>
      o.setName('angka').setDescription(`Antara 1 sampai ${TEBAK_MAKS}`).setRequired(true)
    ) as SlashCommandBuilder,

  executeSlash: async (interaction: ChatInputCommandInteraction) => {
    if (!(await diArena(interaction))) return;
    const angka = interaction.options.getInteger('angka', true);
    if (angka < 1 || angka > TEBAK_MAKS) {
      await interaction.reply({ content: `Antara 1 sampai ${TEBAK_MAKS} aja.`, ephemeral: true });
      return;
    }
    const userId = interaction.user.id;
    let sesi = sesiTebak.get(userId);
    if (!sesi) {
      sesi = { angka: Math.floor(Math.random() * TEBAK_MAKS) + 1, sisa: TEBAK_KESEMPATAN };
      sesiTebak.set(userId, sesi);
    }
    sesi.sisa -= 1;
    const kepakai = TEBAK_KESEMPATAN - sesi.sisa;

    if (angka === sesi.angka) {
      const hadiah = 60 + (TEBAK_KESEMPATAN - kepakai) * 25;
      sesiTebak.delete(userId);
      await prisma.user.upsert({ where: { id: userId }, create: { id: userId }, update: {} });
      await prisma.user.update({ where: { id: userId }, data: { menang: { increment: 1 } } });
      await majuMisi(userId, 'tebak', 1, interaction.client);
      await beriXp(interaction.client, interaction.guild, userId, hadiah);
      await interaction.reply(
        '🎯 ' + suara('tebak_kena', { x: angka, y: kepakai }) + `\nAmbil **${hadiah} XP**.`
      );
      return;
    }

    if (sesi.sisa <= 0) {
      const jawaban = sesi.angka;
      sesiTebak.delete(userId);
      await prisma.user.upsert({ where: { id: userId }, create: { id: userId }, update: {} });
      await prisma.user.update({ where: { id: userId }, data: { kalah: { increment: 1 } } });
      await interaction.reply(suara('tebak_habis', { x: jawaban }));
      return;
    }

    let arah = angka < sesi.angka ? '**lebih besar** ⬆️' : '**lebih kecil** ⬇️';
    if (Math.abs(angka - sesi.angka) <= 5) arah += '  — tapi deket banget, hampir!';
    await interaction.reply(suara('tebak_meleset', { x: angka, arah }) + `\nSisa ${sesi.sisa} kesempatan.`);
  },

  executePrefix: async (message: Message) => {
    message.reply('Pakai slash command `/tebak` ya.');
  }
};

export default tebakCommand;
