import { Client, MessageReaction, PartialMessageReaction, User, PartialUser, EmbedBuilder, Colors, TextChannel } from 'discord.js';
import prisma from '../prisma';
import { logger } from '@hamin/utils';

const CHANNEL_STARBOARD_ID = process.env.JULIAN_CHANNEL_STARBOARD_ID || '1532236816986669056';
const STARBOARD_AKTIF = true;
const STARBOARD_EMOJI = '⭐';
const STARBOARD_AMBANG = 4;

export async function handleStarboard(
  reaction: MessageReaction | PartialMessageReaction,
  _user: User | PartialUser
) {
  if (!STARBOARD_AKTIF || !CHANNEL_STARBOARD_ID) return;
  if (reaction.emoji.name !== STARBOARD_EMOJI) return;
  if (!reaction.message.guild) return;
  if (reaction.message.channelId === CHANNEL_STARBOARD_ID) return;

  // Fetch full reaction/message if partial
  if (reaction.partial) {
    try { reaction = await reaction.fetch(); } catch { return; }
  }
  if (reaction.message.partial) {
    try { await reaction.message.fetch(); } catch { return; }
  }

  const pesan = reaction.message;
  if (pesan.author?.bot) return;

  const jumlah = reaction.count ?? 0;
  if (jumlah < STARBOARD_AMBANG) return;

  const papan = pesan.guild!.channels.cache.get(CHANNEL_STARBOARD_ID) as TextChannel | undefined;
  if (!papan) return;

  // Check if already posted
  const existing = await prisma.starboard.findUnique({ where: { messageId: pesan.id } });

  if (existing) {
    // Update the count in the starboard message
    try {
      const starMsg = await papan.messages.fetch(existing.starMessageId);
      await starMsg.edit({ content: `${STARBOARD_EMOJI} **${jumlah}**  ·  <#${pesan.channelId}>` });
    } catch {
      // Starboard message deleted — remove record
      await prisma.starboard.delete({ where: { messageId: pesan.id } }).catch(() => {});
    }
    return;
  }

  // Build and send embed
  const embed = new EmbedBuilder()
    .setAuthor({ name: pesan.author!.displayName, iconURL: pesan.author!.displayAvatarURL() })
    .setDescription(pesan.content || null)
    .setColor(Colors.Gold)
    .setTimestamp(pesan.createdAt)
    .addFields({ name: '\u200b', value: `[lompat ke pesannya](${pesan.url})`, inline: false });

  const gambar = pesan.attachments.find(a => a.contentType?.startsWith('image/'));
  if (gambar) embed.setImage(gambar.url);

  try {
    const kiriman = await papan.send({
      content: `${STARBOARD_EMOJI} **${jumlah}**  ·  <#${pesan.channelId}>`,
      embeds: [embed]
    });

    await prisma.starboard.create({
      data: {
        messageId: pesan.id,
        starMessageId: kiriman.id,
        channelId: pesan.channelId,
        authorId: pesan.author!.id,
      }
    });
  } catch (err) {
    logger.warn('[starboard] ga punya izin kirim ke channel starboard');
  }
}
