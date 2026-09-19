import test from 'node:test';
import assert from 'node:assert/strict';
import { captureEndpoints } from '../src/protocol/endpoints.js';
import { rawCommandBody } from '../src/protocol.js';

test('version probes retain endpoint identity and failures without inferring official firmware', async () => {
  const calls = [];
  const hid = {
    connected: true, device: { vendorId: 0x3554, productId: 0xf517, productName: 'ATTACK SHARK Mouse' },
    async handshake() { return { cid: 124, mid: 20, deviceType: 5 }; },
    async getCurrentProfile() { return 0; },
    async command(opcode) {
      calls.push(opcode);
      if (opcode === 0x12) throw new Error('timeout');
      return rawCommandBody(opcode, [5, 2]);
    },
  };
  const result = await captureEndpoints(hid, 'versions', 'Official UI v5.23');
  assert.deepEqual(calls, [0x12, 0x1d, 0xb3]);
  assert.equal(result.responses[0].body, null);
  assert.equal(result.responses[0].error, 'timeout');
  assert.deepEqual(result.responses[2].body, [...rawCommandBody(0xb3, [5, 2])]);
  assert.equal(result.notes, 'Official UI v5.23');
  assert.equal(Object.hasOwn(result, 'mouseFirmware'), false);
  calls.length = 0;
  const receiver = await captureEndpoints(hid, 'receiver');
  assert.deepEqual(calls, [0x2d, 0x19]);
  assert.equal(receiver.responses.length, 2);
  await assert.rejects(captureEndpoints(hid, 'bootloader'), /Unknown/);
  await assert.rejects(captureEndpoints(hid, 'toString'), /Unknown/);
});
