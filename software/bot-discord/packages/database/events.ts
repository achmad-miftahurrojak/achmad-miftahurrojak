import { randomUUID } from 'node:crypto';

export type BotEventType =
  | 'config.updated'
  | 'member.joined'
  | 'ticket.created'
  | 'user.xp.updated';

export interface BotEvent<TPayload = Record<string, unknown>> {
  id: string;
  type: BotEventType;
  guildId: string;
  entityId?: string;
  version: number;
  payload: TPayload;
  createdAt: string;
}

const MAX_EVENT_BYTES = 32 * 1024;

export function createEvent<TPayload>(
  type: BotEventType,
  guildId: string,
  payload: TPayload,
  options: { entityId?: string; version?: number } = {}
): BotEvent<TPayload> {
  if (!guildId.trim()) throw new Error('guildId is required');

  const event: BotEvent<TPayload> = {
    id: randomUUID(),
    type,
    guildId,
    ...(options.entityId ? { entityId: options.entityId } : {}),
    version: options.version ?? 1,
    payload,
    createdAt: new Date().toISOString()
  };

  serializeEvent(event);
  return event;
}

export function serializeEvent<TPayload>(event: BotEvent<TPayload>): string {
  const serialized = JSON.stringify(event);
  if (Buffer.byteLength(serialized, 'utf8') > MAX_EVENT_BYTES) {
    throw new Error('event payload exceeds 32 KiB');
  }
  return serialized;
}

export function parseEvent(serialized: string): BotEvent {
  if (Buffer.byteLength(serialized, 'utf8') > MAX_EVENT_BYTES) {
    throw new Error('event payload exceeds 32 KiB');
  }

  let value: unknown;
  try {
    value = JSON.parse(serialized);
  } catch {
    throw new Error('event payload is not valid JSON');
  }

  if (!value || typeof value !== 'object') throw new Error('event must be an object');
  const event = value as Partial<BotEvent>;
  if (typeof event.id !== 'string' || !event.id) throw new Error('event id is required');
  if (typeof event.type !== 'string' || !event.type) throw new Error('event type is required');
  if (typeof event.guildId !== 'string' || !event.guildId.trim()) throw new Error('guildId is required');
  if (typeof event.version !== 'number') throw new Error('event version is required');
  if (typeof event.createdAt !== 'string' || !event.createdAt) throw new Error('event createdAt is required');
  if (!('payload' in event)) throw new Error('event payload is required');

  return event as BotEvent;
}