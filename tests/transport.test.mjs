import test from 'node:test';
import assert from 'node:assert/strict';
import { CompXDevice, packetBody, rawCommandBody } from '../src/protocol.js';

const tick = () => new Promise((resolve) => setImmediate(resolve));
function inject(hid, body, reportId = 8) {
  hid._onInputReport({ reportId, data: new DataView(body.buffer, body.byteOffset, body.byteLength) });
}
function transport() {
  const hid = new CompXDevice();
  const sent = [];
  hid.device = { opened: true, async sendReport(_id, bytes) { sent.push(bytes); }, async close() { this.opened = false; }, removeEventListener() {} };
  return { hid, sent };
}

test('flash read ignores malformed replies and reads in ordered 10-byte chunks', async () => {
  const { hid, sent } = transport();
  const progress = [];
  const reading = hid.readFlash(0x1b00, 12, { onProgress: (done, total) => progress.push([done, total]) });
  await tick();
  const valid = packetBody(8, { address: 0x1b00, length: 10, payload: [1,2,3,4,5,6,7,8,9,10] });
  const corrupt = valid.slice(); corrupt[5] ^= 1;
  inject(hid, corrupt);
  inject(hid, valid.slice(0, 15));
  inject(hid, valid, 7);
  inject(hid, packetBody(8, { address: 0x1b00, length: 9 }));
  inject(hid, packetBody(8, { address: 0x1b01, length: 10 }));
  await tick();
  assert.equal(sent.length, 1);
  assert.equal(hid.waiters.length, 1);
  inject(hid, valid);
  await tick();
  assert.equal(sent.length, 2);
  assert.equal(sent[1][3], 0x0a);
  assert.equal(sent[1][4], 2);
  inject(hid, packetBody(8, { address: 0x1b0a, length: 2, payload: [11, 12] }));
  assert.deepEqual([...await reading], [1,2,3,4,5,6,7,8,9,10,11,12]);
  assert.deepEqual(progress, [[10,12], [12,12]]);
});

test('flash bounds and malformed data reject before sending any packet', async () => {
  const { hid, sent } = transport();
  for (const [address, length] of [[-1, 1], [0, 0], [0, -1], [0, 1.1], [0xffff, 2], [NaN, 2], [0, Infinity]]) {
    await assert.rejects(hid.readFlash(address, length), /Flash range/);
  }
  await assert.rejects(hid.writeFlash(0xffff, [1, 2]), /Flash range/);
  await assert.rejects(hid.writeFlash(0, [256]), /integer bytes/);
  assert.equal(sent.length, 0);
});

test('send-only commands cannot overtake a pending exchange', async () => {
  const { hid, sent } = transport();
  const response = hid.command(0x04);
  const setting = hid.setLongRangeMode(true);
  await tick();
  assert.deepEqual(sent.map((x) => x[0]), [4]);
  inject(hid, rawCommandBody(4, [55, 0, 0x0f, 0x32]));
  await Promise.all([response, setting]);
  assert.deepEqual(sent.map((x) => x[0]), [4, 0x16]);
});

test('send failures and timeouts remove waiters and leave the queue usable', async () => {
  const { hid } = transport();
  hid.device.sendReport = async () => { throw new Error('send failed'); };
  await assert.rejects(hid.command(4), /send failed/);
  await tick();
  assert.equal(hid.waiters.length, 0);
  hid.device.sendReport = async () => {};
  await assert.rejects(hid.command(4, [], { timeoutMs: 5 }), /timed out/);
  assert.equal(hid.waiters.length, 0);
  const next = hid.command(4);
  await tick(); inject(hid, rawCommandBody(4, [50]));
  assert.equal((await next)[5], 50);
});

test('disconnect rejects pending and queued work instead of sending to a replacement device', async () => {
  const { hid, sent } = transport();
  const pending = hid.command(4);
  const queued = hid.command(0x12);
  const results = Promise.allSettled([pending, queued]);
  await tick(); await hid.close();
  const values = await results;
  assert.equal(values[0].status, 'rejected');
  assert.match(values[1].reason.message, /connection changed/);
  assert.equal(sent.length, 1);
  assert.equal(hid.waiters.length, 0);
});

test('a chunked write cannot continue after the HID connection changes', async () => {
  const { hid, sent } = transport();
  hid.device.sendReport = async (_id, bytes) => { sent.push(bytes); hid._connectionGeneration += 1; };
  await assert.rejects(hid.writeFlash(0, new Uint8Array(12), { verify: false, pacingMs: 0 }), /connection changed/);
  assert.equal(sent.length, 1);
});
