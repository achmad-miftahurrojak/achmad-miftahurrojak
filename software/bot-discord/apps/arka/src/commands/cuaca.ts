import { SlashCommandBuilder, ChatInputCommandInteraction, Message } from 'discord.js';
import { Command } from '../handler';
import { cuacaHariIni } from '../core';

const cuacaCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('cuaca')
    .setDescription('Cek cuaca hari ini (pengaruh ke XP)') as SlashCommandBuilder,
  
  executeSlash: async (interaction: ChatInputCommandInteraction) => {
    const cuaca = await cuacaHariIni();
    await interaction.reply(`${cuaca.cuacaEmoji} **${cuaca.cuacaNama}**\n${cuaca.cuacaKata}\n*(XP hari ini x${cuaca.cuacaKali})*`);
  },

  executePrefix: async (message: Message, args: string[]) => {
    const cuaca = await cuacaHariIni();
    message.reply(`${cuaca.cuacaEmoji} **${cuaca.cuacaNama}**\n${cuaca.cuacaKata}\n*(XP hari ini x${cuaca.cuacaKali})*`);
  }
};

export default cuacaCommand;
