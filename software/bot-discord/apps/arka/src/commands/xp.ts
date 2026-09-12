import { SlashCommandBuilder, ChatInputCommandInteraction, Message, AttachmentBuilder } from 'discord.js';
import { Command } from '../handler';
import prisma from '../prisma';
import { tingkat, berikutnya } from '../core';
import { LENCANA } from '../config';
import { buatKartuLevel } from '../utils/kartu_level';

const profilCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('profil')
    .setDescription('Lihat profil dan level XP kamu (atau orang lain)')
    .addUserOption(option => 
      option.setName('target')
        .setDescription('Orang yang pengen lu intip profilnya')
        .setRequired(false)
    ) as SlashCommandBuilder,
  
  executeSlash: async (interaction: ChatInputCommandInteraction) => {
    await interaction.deferReply();
    const targetUser = interaction.options.getUser('target') || interaction.user;
    const member = await interaction.guild?.members.fetch(targetUser.id);
    
    if (!member) {
      return interaction.editReply('Gak ketemu membernya di server ini.');
    }

    if (targetUser.bot) {
      return interaction.editReply('Bot gak punya level, bos.');
    }

    const user = await prisma.user.findUnique({ where: { id: targetUser.id } });
    if (!user) {
      return interaction.editReply('Belum punya data XP, suruh ngobrol dulu gih.');
    }

    const arkaUser = await prisma.arkaUser.findUnique({ where: { userId: targetUser.id } });
    const catat = arkaUser || {};

    const xp = user.xp;
    const sekarang = tingkat(xp);
    const depan = berikutnya(xp);
    
    // Hitung lencana
    const lencanaPunya = LENCANA.filter(l => {
      const field = l[4] as keyof typeof user;
      return user[field] && (user[field] as number) >= (l[5] as number);
    });

    // Peringkat (kurang efisien untuk data besar, tapi sesuai aslinya)
    const semua = await prisma.user.findMany({
      where: { xp: { gt: 0 } },
      select: { id: true, xp: true },
      orderBy: { xp: 'desc' }
    });
    
    // Filter by members in guild
    const guildMembers = await interaction.guild?.members.fetch();
    const hidup = semua.filter(u => guildMembers?.has(u.id));
    
    let peringkat = null;
    for (let i = 0; i < hidup.length; i++) {
      if (hidup[i].id === targetUser.id) {
        peringkat = i + 1;
        break;
      }
    }

    const avatarUrl = targetUser.displayAvatarURL({ extension: 'png', size: 256 });
    
    const buffer = await buatKartuLevel(
      member.displayName,
      avatarUrl,
      sekarang[1] as string,
      xp,
      sekarang[0] as number,
      depan ? (depan[0] as number) : null,
      peringkat,
      lencanaPunya,
      catat
    );

    const attachment = new AttachmentBuilder(buffer, { name: 'level.png' });
    await interaction.editReply({ files: [attachment] });
  },

  executePrefix: async (message: Message, args: string[]) => {
    // Prefix fallback if needed
    message.reply('Pakai slash command `/profil` ya.');
  }
};

export default profilCommand;
