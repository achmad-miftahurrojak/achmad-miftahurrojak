import { Command } from '../handler';

const command: Command = {
  name: 'ping',
  description: 'Replies with Pong!',
  executePrefix: async (message, args) => {
    await message.reply('Pong!');
  }
};

export default command;
