import { Client, Message, ChatInputCommandInteraction, Collection, REST, Routes, ContextMenuCommandBuilder } from 'discord.js';
import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';
import { logger } from '@hamin/utils';

export interface Command {
  name: string;
  description?: string;
  data?: any; // SlashCommandBuilder
  executePrefix?: (message: Message, args: string[]) => Promise<void>;
  executeSlash?: (interaction: ChatInputCommandInteraction) => Promise<void>;
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
    if (mod.default && mod.default.name) {
      commands.set(mod.default.name, mod.default);
      logger.info(`Loaded command: ${mod.default.name}`);
      continue;
    }

    // Support named export { data, executeSlash } (new pattern)
    if (mod.data && mod.executeSlash) {
      const cmd: Command = {
        name: mod.data.name,
        data: mod.data,
        executeSlash: mod.executeSlash,
        executePrefix: mod.executePrefix,
      };
      commands.set(cmd.name, cmd);
      logger.info(`Loaded command: ${cmd.name}`);
      continue;
    }

    // Support multiple named commands from one file (e.g. tiket.ts with paneltiket + tiket)
    const namedPairs = Object.keys(mod)
      .filter(k => k.endsWith('Data'))
      .flatMap(k => {
        const execKey = k.replace('Data', 'Slash');
        return mod[execKey] ? [{ data: mod[k], executeSlash: mod[execKey] as (i: ChatInputCommandInteraction) => Promise<void> }] : [];
      }) as { data: any; executeSlash: (i: ChatInputCommandInteraction) => Promise<void> }[];

    for (const pair of namedPairs) {
      const cmd: Command = {
        name: pair.data.name,
        data: pair.data,
        executeSlash: pair.executeSlash,
      };
      commands.set(cmd.name, cmd);
      logger.info(`Loaded command: ${cmd.name}`);
    }
  }
}

export async function registerSlashCommands(clientId: string, token: string, extraData?: any[]) {
  const body = [...commands.values()]
    .filter(c => c.data)
    .map(c => c.data.toJSON());
  if (extraData) body.push(...extraData);

  if (body.length === 0) return;

  const rest = new REST({ version: '10' }).setToken(token);
  try {
    await rest.put(Routes.applicationCommands(clientId), { body });
    logger.info(`[handler] ${body.length} slash command terdaftar ke Discord`);
  } catch (err) {
    logger.error(err, '[handler] gagal daftar slash command');
  }
}
