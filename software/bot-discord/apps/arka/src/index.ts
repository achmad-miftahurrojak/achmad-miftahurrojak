import { Client, GatewayIntentBits, ActivityType } from 'discord.js';
import { CHANNELS, commandChannelMessage, isCommandAllowed, logger } from '@hamin/utils';
import * as path from 'path';
import { loadCommands, commands, registerSlashCommands } from './handler';
import { initCore, gantiStatus } from './core';
import { jalankanKomponen } from './gameCore';
import { cekJawabanTrivia } from './commands/trivia';
import { cekJawabanLagu } from './commands/lagu';
import { lombaOnMessage, mulaiLoopLombaAcara } from './commands/lomba';
import { mulaiLoopCadangan } from './commands/cadangan';
import { cekRantai, chatXp, mulaiSemuaLoop } from './loops';
import prisma from './prisma';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

const CHANNEL_RULES = {
  absen: [CHANNELS.quest], misi: [CHANNELS.quest], quest: [CHANNELS.quest],
  trivia: [CHANNELS.trivia], lagu: [CHANNELS.song], tambahlagu: [CHANNELS.song],
  akinator: [CHANNELS.akinator], turnamen: [CHANNELS.suit], balon: [CHANNELS.balloon],
  lomba: [CHANNELS.contest], lombatutup: [CHANNELS.contest],
  acara: [CHANNELS.volleyball, CHANNELS.karaoke], acaralist: [CHANNELS.volleyball, CHANNELS.karaoke],
  acarahapus: [CHANNELS.volleyball, CHANNELS.karaoke], acaraedit: [CHANNELS.volleyball, CHANNELS.karaoke],
  backup: [CHANNELS.backup], hunt: [CHANNELS.hunt], koleksi: [CHANNELS.hunt],
  duel: [CHANNELS.duel], tebak: [CHANNELS.guessNumber], suit: [CHANNELS.suit], rantai: [CHANNELS.chain],
  toko: [CHANNELS.games], beli: [CHANNELS.games], tas: [CHANNELS.games], kasihitem: [CHANNELS.games],
  wishlist: [CHANNELS.games], pakai: [CHANNELS.games], profil: [CHANNELS.statistics],
  level: [CHANNELS.statistics], peringkat: [CHANNELS.statistics], rekap: [CHANNELS.recap],
  hall: [CHANNELS.statistics], statistik: [CHANNELS.statistics], panduan: [CHANNELS.summerGames]
} as const;

client.once('ready', async () => {
  logger.info(`Logged in as ${client.user?.tag}!`);

  // Load commands
  await loadCommands(path.join(__dirname, 'commands'));

  // Initialize Arka core loops
  initCore(client, prisma);

  // Gudang soal & lagu + loop lomba/acara/cadangan
  const { muatSoal } = await import('./commands/trivia');
  const { muatLagu } = await import('./commands/lagu');
  muatSoal();
  muatLagu();
  mulaiLoopLombaAcara(client);
  mulaiLoopCadangan(client);
  mulaiSemuaLoop(client);

  // Daftarin slash command ke Discord
  if (client.user && process.env.ARKA_TOKEN) {
    await registerSlashCommands(client.user.id, process.env.ARKA_TOKEN);
  }

  // Rotating status
  setInterval(() => {
    gantiStatus(client);
  }, 10_000);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;

  // Cek jawaban trivia & lagu dulu (game di chat)
  try {
    if (await cekJawabanTrivia(message)) return;
    if (await cekJawabanLagu(message)) return;
    await lombaOnMessage(message, client);
    if (await cekRantai(client, message)) return;
    await chatXp(client, message);
  } catch (error) {
    logger.error(error, 'Error di listener game chat');
  }

  const prefix = '!'; // Or from config
  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const commandName = args.shift()?.toLowerCase();
  
  if (!commandName) return;

  const command = commands.get(commandName);
  if (!command || !command.executePrefix) return;

  if (!isCommandAllowed(commandName, message.channelId, CHANNEL_RULES)) {
    await message.reply(commandChannelMessage(commandName, CHANNEL_RULES));
    return;
  }

  try {
    await command.executePrefix(message, args);
  } catch (error) {
    logger.error(error, `Error executing command ${commandName}`);
    message.reply('There was an error executing that command!');
  }
});

client.on('interactionCreate', async (interaction) => {
  if (interaction.isButton()) {
    try {
      await jalankanKomponen(interaction);
    } catch (error) {
      logger.error(error, 'Error handling button interaction');
    }
    return;
  }

  if (interaction.isChatInputCommand()) {
    const command = commands.get(interaction.commandName);
    if (!command || !command.executeSlash) return;

    try {
      if (!isCommandAllowed(interaction.commandName, interaction.channelId, CHANNEL_RULES)) {
        await interaction.reply({ content: commandChannelMessage(interaction.commandName, CHANNEL_RULES), ephemeral: true });
        return;
      }
      await command.executeSlash(interaction);
    } catch (error) {
      logger.error(error, `Error executing slash command ${interaction.commandName}`);
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: 'There was an error executing this command!', ephemeral: true });
      } else {
        await interaction.reply({ content: 'There was an error executing this command!', ephemeral: true });
      }
    }
  }
});

client.login(process.env.ARKA_TOKEN).catch((err) => {
  logger.error(err, 'Failed to login');
});
