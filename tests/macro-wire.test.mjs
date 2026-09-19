import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeMacro, decodeMacro, encodeShortcut, decodeShortcut } from '../src/codecs.js';

// Independently constructed from the DLL's [31, 32 + 5*n) checksum range.
// 02 + 81 04 00 00 0C + 41 04 00 00 22 + 5B = 0x155.
function fixture() {
  const raw = new Uint8Array(384).fill(0xa5);
  raw.set([4, 84, 101, 115, 116]); // Test
  raw.set([2, 0x81, 4, 0, 0, 12, 0x41, 4, 0, 0, 34, 0x5b], 31);
  return raw;
}

test('macro checksum covers count and events, independently of name and opaque header padding', () => {
  const raw = fixture();
  const parsed = decodeMacro(raw);
  assert.equal(parsed.valid, true);
  assert.equal(parsed.name, 'Test');
  assert.deepEqual(encodeMacro(parsed, { original: raw }), raw);
  const renamed = encodeMacro({ ...parsed, name: 'A' }, { original: raw });
  assert.equal(renamed[42], 0x5b);
  assert.deepEqual(renamed.slice(2, 31), raw.slice(2, 31));
  raw[20] ^= 0xff;
  assert.equal(decodeMacro(raw).valid, true);
  raw[36] ^= 1;
  assert.equal(decodeMacro(raw).valid, false);
});

test('macro and shortcut counts reject invalid records instead of clamping or truncating', () => {
  for (const count of [0, 1, 71, 255]) {
    const raw = fixture(); raw[31] = count;
    assert.equal(decodeMacro(raw).valid, false);
    assert.throws(() => encodeMacro({ events: Array(count).fill({}) }), /2–70/);
  }
  for (const count of [0, 1, 7, 255]) {
    const raw = new Uint8Array(32); raw[0] = count;
    assert.equal(decodeShortcut(raw).valid, false);
    assert.throws(() => encodeShortcut(Array(count).fill({})), /2–6/);
  }
  const full = encodeMacro({ events: Array(70).fill({ kind: 'key-up', code: 1, usage: 4 }) });
  assert.equal(decodeMacro(full).valid, true);
  assert.equal(decodeMacro(full).events.length, 70);
});
