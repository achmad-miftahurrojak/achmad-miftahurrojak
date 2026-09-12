import assert from 'node:assert/strict';
import test from 'node:test';
import { createEvent, parseEvent, serializeEvent } from './events';

test('creates and round-trips a guild-scoped event', () => {
  const event = createEvent('config.updated', 'guild-1', { setting: 'value' });
  const parsed = parseEvent(serializeEvent(event));

  assert.equal(parsed.id, event.id);
  assert.equal(parsed.type, 'config.updated');
  assert.equal(parsed.guildId, 'guild-1');
  assert.deepEqual(parsed.payload, { setting: 'value' });
});

test('rejects events without a guild id', () => {
  assert.throws(() => createEvent('config.updated', '', {}), /guildId/);
});

test('rejects payloads larger than 32 KiB', () => {
  assert.throws(
    () => createEvent('config.updated', 'guild-1', { value: 'x'.repeat(33 * 1024) }),
    /32 KiB/
  );
});