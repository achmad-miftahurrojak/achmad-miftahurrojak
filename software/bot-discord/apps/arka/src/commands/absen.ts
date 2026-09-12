import { SlashCommandBuilder, ChatInputCommandInteraction, Message } from 'discord.js';
import { Command } from '../handler';
import prisma from '../prisma';
import { tambahXp } from '../core';

const absenCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('absen')
    .setDescription('Absen harian buat dapet XP') as SlashCommandBuilder,
  
  executeSlash: async (interaction: ChatInputCommandInteraction) => {
    await interaction.deferReply();
    const userId = interaction.user.id;
    const member = await interaction.guild?.members.fetch(userId);
    if (!member) {
      return interaction.editReply('Error mengambil data member.');
    }

    const hariIni = new Date();
    // Normalisasi ke midnight
    hariIni.setHours(0, 0, 0, 0);

    const user = await prisma.user.upsert({
      where: { id: userId },
      create: { id: userId },
      update: {}
    });

    if (user.absenTerakhir && user.absenTerakhir >= hariIni) {
      return interaction.editReply('Lu udah absen hari ini. Balik lagi besok.');
    }

    // Cek beruntun (kalo kemarin absen)
    const kemarin = new Date(hariIni);
    kemarin.setDate(kemarin.getDate() - 1);
    
    let absenPanjang = user.absenPanjang || 0;
    
    if (user.absenTerakhir && user.absenTerakhir.getTime() === kemarin.getTime()) {
      absenPanjang += 1;
    } else {
      absenPanjang = 1;
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        absen: user.absen + 1,
        absenTerakhir: hariIni,
        absenPanjang: absenPanjang
      }
    });

    const xpDapat = 100 + (absenPanjang * 10); // Contoh rumus
    await tambahXp(interaction.client, member, xpDapat);

    await interaction.editReply(`✅ Absen berhasil! Lu dapet **${xpDapat} XP**.\n*(Absen beruntun: ${absenPanjang} hari)*`);
  },

  executePrefix: async (message: Message, args: string[]) => {
    message.reply('Pakai slash command `/absen` ya.');
  }
};

export default absenCommand;
