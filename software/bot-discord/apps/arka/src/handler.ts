import { Client, Message, ChatInputCommandInteraction, Collection, REST, Routes } from 'discord.js';
import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';
import { logger } from '@hamin/utils';

export interface Command {
  name?: string;
  description?: string;
  data?: any; // SlashCommandBuilder
  executePrefix?: (message: Message, args: string[]) => Promise<unknown>;
  executeSlash?: (interaction: ChatInputCommandInteraction) => Promise<unknown>;
}

export const commands = new Collection<string, Command>();

export async function loadCommands(commandsPath: string) {
  if (!fs.existsSync(commandsPath)) return;
  const files = fs.readdirSync(commandsPath).filter(file => file.endsWith('.ts') || file.endsWith('.js'));

  for (const file of files) {
    const filePath = path.join(commandsPath, file);
    const fileUrl = pathToFileURL(filePath).href;
    const mod = await import(fileUrl);

    // Support default export (legacy pattern)
    if (mod.default && (mod.default.name || mod.default.data)) {
      const cmd = mod.default as Command;
      const nama = cmd.name ?? cmd.data?.name ?? 'tanpa-nama';
      commands.set(nama, cmd);
      logger.info(`Loaded command: ${nama}`);
      continue;
    }

    // Support named export { data, executeSlash } (new pattern)
    if (mod.data && mod.executeSlash) {
      const namaBaru: string = mod.data.name ?? 'tanpa-nama';
      const cmd: Command = {
        name: namaBaru,
        data: mod.data,
        executeSlash: mod.executeSlash,
        executePrefix: mod.executePrefix,
      };
      commands.set(namaBaru, cmd);
      logger.info(`Loaded command: ${namaBaru}`);
      continue;
    }

    // Support multiple named commands from one file
    // Pola A: { xxxData, xxxSlash }
    const namedPairs = Object.keys(mod)
      .filter(k => k.endsWith('Data'))
      .flatMap(k => {
        const execKey = k.replace('Data', 'Slash');
        return mod[execKey] ? [{ data: mod[k], executeSlash: mod[execKey] as (i: ChatInputCommandInteraction) => Promise<void> }] : [];
      }) as { data: any; executeSlash: (i: ChatInputCommandInteraction) => Promise<void> }[];

    // Pola B: objek command bernama { xxxCommand: { data, executeSlash } }
    const objectCommands = Object.values(mod)
      .filter((v: any) => v && typeof v === 'object' && v.data && typeof v.executeSlash === 'function')
      .map((v: any) => ({ data: v.data, executeSlash: v.executeSlash as (i: ChatInputCommandInteraction) => Promise<void> }));

    const semua = [...namedPairs, ...objectCommands];
    if (semua.length === 0 && !mod.default) continue;

    for (const pair of semua) {
      const nama: string = pair.data.name ?? 'tanpa-nama';
      const cmd: Command = {
        name: nama,
        data: pair.data,
        executeSlash: pair.executeSlash,
      };
      commands.set(nama, cmd);
      logger.info(`Loaded command: ${nama}`);
    }
  }
}

export async function registerSlashCommands(clientId: string, token: string) {
  const body = [...commands.values()]
    .filter(c => c.data)
    .map(c => c.data.toJSON());

  if (body.length === 0) return;

  const rest = new REST({ version: '10' }).setToken(token);
  try {
    await rest.put(Routes.applicationCommands(clientId), { body });
    logger.info(`[handler] ${body.length} slash command terdaftar ke Discord`);
  } catch (err) {
    logger.error(err, '[handler] gagal daftar slash command');
  }
}
