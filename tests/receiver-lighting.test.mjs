import test from 'node:test';
import assert from 'node:assert/strict';
import { CompXDevice, packetChecksumValid, rawCommandBody } from '../src/protocol.js';
import { MouseModel } from '../src/device-model.js';
import { renderReceiverLighting } from '../src/ui/receiver-lighting.js';

test('indicator protocol reads and writes three independent bytes in LED order', async () => {
  const hid = new CompXDevice(); const sent = [];
  hid.command = async (opcode) => { assert.equal(opcode, 0x2d); return rawCommandBody(opcode, [3, 2, 1]); };
  hid.send = async (body) => sent.push(body);
  assert.deepEqual((await hid.getReceiverIndicator()).assignments, [3, 2, 1]);
  await hid.setReceiverIndicator([0xfd, 2, 1]);
  assert.deepEqual([...sent[0].slice(0, 8)], [0x2c, 0, 0, 0, 0x0a, 0xfd, 2, 1]);
  assert.equal(packetChecksumValid(sent[0]), true);
  for (const value of [[1], [1, 2, 3, 4], [1, -1, 2], [1, 256, 2]]) await assert.rejects(hid.setReceiverIndicator(value));
  assert.equal(sent.length, 1);
});

test('editing one receiver LED refreshes state, preserves unknown neighbors and verifies read-back', async () => {
  let assignments = [0xfe, 2, 0xfc]; let reads = 0; const writes = [];
  const hid = {
    async getReceiverIndicator() { reads++; return { assignments: [...assignments] }; },
    async setReceiverIndicator(value) { writes.push([...value]); assignments = [...value]; },
  };
  const model = new MouseModel(hid);
  await assert.rejects(model.setReceiverIndicator(1, 3), /Expert writes/);
  assert.equal(reads, 0);
  model.expertWrites = true;
  await model.setReceiverIndicator(1, 3);
  assert.deepEqual(writes, [[0xfe, 3, 0xfc]]);
  assert.equal(reads, 2);
  await model.setReceiverIndicator(1, 3);
  assert.equal(writes.length, 1);
  hid.setReceiverIndicator = async () => {};
  await assert.rejects(model.setReceiverIndicator(1, 1), /read-back mismatch/);
  for (const index of [-1, 3, 1.5]) await assert.rejects(model.setReceiverIndicator(index, 0), /index/);
});

test('receiver controls require a read and preserve an unknown selected value', () => {
  const empty = renderReceiverLighting(null);
  assert.equal((empty.match(/data-save-receiver-led=/g) ?? []).length, 3);
  assert.equal((empty.match(/data-write disabled/g) ?? []).length, 3);
  const loaded = renderReceiverLighting({ assignments: [0xfe, 2, 1], raw: [3, 2, 1] });
  assert.match(loaded, /value="254" selected>Keep unknown raw 254/);
  assert.match(loaded, /LED 1/); assert.match(loaded, /LED 2/); assert.match(loaded, /LED 3/);
});
