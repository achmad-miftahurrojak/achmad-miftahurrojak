import { Prisma } from '@prisma/client';
import { PrismaClient } from '@prisma/client';
import { Client as PgClient } from 'pg';
import { BotEvent, serializeEvent } from './events';

export const BOT_EVENT_CHANNEL = 'hamin_bot_events';

type EventTransaction = Pick<Prisma.TransactionClient, 'outboxEvent' | '$executeRaw'>;

type EventDatabase = Pick<PrismaClient, 'outboxEvent' | 'outboxDelivery' | 'eventConsumer'>;

export interface EventSubscriberOptions {
  databaseUrl: string;
  database: EventDatabase;
  consumer: string;
  eventTypes: BotEvent['type'][];
  onEvent: (event: BotEvent) => Promise<void>;
  pollIntervalMs?: number;
  batchSize?: number;
  maxAttempts?: number;
}

export function retryDelayMs(attempt: number): number {
  return Math.min(60_000, 1_000 * 2 ** Math.max(0, attempt - 1));
}

export async function publishEvent(transaction: EventTransaction, event: BotEvent): Promise<void> {
  const serialized = serializeEvent(event);

  await transaction.outboxEvent.create({
    data: {
      id: event.id,
      type: event.type,
      guildId: event.guildId,
      entityId: event.entityId,
      version: event.version,
      payload: event.payload as Prisma.InputJsonValue,
    }
  });

  await transaction.$executeRaw`SELECT pg_notify(${BOT_EVENT_CHANNEL}, ${serialized})`;
}

export async function startEventSubscriber(options: EventSubscriberOptions): Promise<() => Promise<void>> {
  const pollIntervalMs = options.pollIntervalMs ?? 5_000;
  const batchSize = options.batchSize ?? 100;
  const maxAttempts = options.maxAttempts ?? 5;
  let pg: PgClient | null = null;
  let reconnecting = false;
  let reconnectTimer: NodeJS.Timeout | null = null;
  let draining = false;
  let stopped = false;

  const drain = async () => {
    if (stopped || draining) return;
    draining = true;
    try {
      const cursor = await options.database.eventConsumer.upsert({
        where: { consumer: options.consumer },
        create: { consumer: options.consumer },
        update: {}
      });
      const events = await options.database.outboxEvent.findMany({
        where: { sequence: { gt: cursor.lastSequence }, type: { in: options.eventTypes } },
        orderBy: { sequence: 'asc' },
        take: batchSize
      });

      for (const event of events) {
        await options.database.outboxDelivery.upsert({
          where: { eventId_consumer: { eventId: event.id, consumer: options.consumer } },
          create: { eventId: event.id, consumer: options.consumer },
          update: {}
        });
        await options.database.eventConsumer.update({
          where: { consumer: options.consumer },
          data: { lastSequence: event.sequence }
        });
      }

      const pending = await options.database.outboxDelivery.findMany({
        where: {
          consumer: options.consumer,
          processedAt: null,
          failedAt: null,
          availableAt: { lte: new Date() },
          attempts: { lt: maxAttempts },
          OR: [{ lockedUntil: null }, { lockedUntil: { lt: new Date() } }],
          event: { type: { in: options.eventTypes } }
        },
        include: { event: true },
        orderBy: { createdAt: 'asc' },
        take: batchSize
      });

      for (const delivery of pending) {
        const lockedUntil = new Date(Date.now() + 60_000);
        const claimed = await options.database.outboxDelivery.updateMany({
          where: {
            id: delivery.id,
            processedAt: null,
            failedAt: null,
            attempts: { lt: maxAttempts },
            OR: [{ lockedUntil: null }, { lockedUntil: { lt: new Date() } }]
          },
          data: { attempts: { increment: 1 }, lockedUntil }
        });
        if (claimed.count === 0) continue;

        try {
          await options.onEvent({
            id: delivery.event.id,
            type: delivery.event.type as BotEvent['type'],
            guildId: delivery.event.guildId,
            ...(delivery.event.entityId ? { entityId: delivery.event.entityId } : {}),
            version: delivery.event.version,
            payload: delivery.event.payload as BotEvent['payload'],
            createdAt: delivery.event.createdAt.toISOString()
          });
          await options.database.outboxDelivery.update({
            where: { id: delivery.id },
            data: { processedAt: new Date(), lockedUntil: null }
          });
        } catch (error) {
          const attempt = delivery.attempts + 1;
          await options.database.outboxDelivery.update({
            where: { id: delivery.id },
            data: {
              availableAt: new Date(Date.now() + retryDelayMs(attempt)),
              failedAt: attempt >= maxAttempts ? new Date() : null,
              lastError: String(error).slice(0, 500),
              lockedUntil: null
            }
          });
        }
      }
    } finally {
      draining = false;
    }
  };

  const connect = async () => {
    if (stopped || pg) return;
    const next = new PgClient({ connectionString: options.databaseUrl });
    next.on('notification', () => void drain().catch(() => {}));
    next.on('error', () => {
      pg = null;
      if (!reconnecting && !stopped) {
        reconnecting = true;
        reconnectTimer = setTimeout(() => {
          reconnecting = false;
          void connect().catch(() => {});
        }, 5_000);
      }
    });
    await next.connect();
    await next.query(`LISTEN ${BOT_EVENT_CHANNEL}`);
    pg = next;
  };

  // ponytail: exponential backoff connect, maxAttempts tries
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await connect();
      break;
    } catch (err) {
      if (attempt === maxAttempts) throw err;
      const delay = retryDelayMs(attempt);
      console.warn(`[eventBus] connect attempt ${attempt} failed, retry in ${delay}ms`);
      await new Promise(r => setTimeout(r, delay));
    }
  }

  if (!pg) throw new Error('event bus not connected after retries');
  const timer = setInterval(() => void drain(), pollIntervalMs);
  timer.unref?.();
  await drain();

  return async () => {
    stopped = true;
    clearInterval(timer);
    if (reconnectTimer) clearTimeout(reconnectTimer);
    await pg?.query(`UNLISTEN ${BOT_EVENT_CHANNEL}`).catch(() => {});
    await pg?.end().catch(() => {});
    pg = null;
  };
}