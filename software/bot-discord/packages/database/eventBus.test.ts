import assert from 'node:assert/strict';
import test from 'node:test';
import { createEvent } from './events';
import { publishEvent, retryDelayMs } from './eventBus';

test('publishes an event through the caller transaction', async () => {
  const calls: unknown[] = [];
  const transaction = {
    outboxEvent: {
      create: async (args: unknown) => calls.push(['create', args])
    },
    $executeRaw: async (...args: unknown[]) => calls.push(['notify', args])
  } as never;
  const event = createEvent('config.updated', 'guild-1', { setting: 'value' });

  await publishEvent(transaction, event);

  assert.equal(calls.length, 2);
  assert.equal(calls[0] instanceof Array && calls[0][0], 'create');
  assert.equal(calls[1] instanceof Array && calls[1][0], 'notify');
});

test('caps retry backoff at one minute', () => {
  assert.equal(retryDelayMs(1), 1_000);
  assert.equal(retryDelayMs(7), 60_000);
});