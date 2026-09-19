import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeAngle, decodeAngle } from '../src/features/sensor/angle.js';
import { MouseModel } from '../src/device-model.js';
import { parityPair } from '../src/codecs.js';
import { ADDRESS } from '../src/constants.js';
import { fieldForAddress } from '../src/protocol-map.js';

test('desktop signed angle encoding spans -30 to +30 without clamping unknown values', () => {
  for (const [degrees, raw] of [[-30, 0xe2], [-1, 0xff], [0, 0], [1, 1], [30, 0x1e]]) {
    assert.equal(encodeAngle(degrees), raw);
    assert.equal(decodeAngle(raw), degrees);
  }
  for (const degrees of [-31, 31, NaN, 0.5, null]) assert.throws(() => encodeAngle(degrees));
  for (const raw of [31, 225, 256, null]) assert.equal(decodeAngle(raw), null);
});

test('sensor state uses BD/BF and E1; earlier 0006/0008 guesses stay unknown', () => {
  const base = new Uint8Array(232);
  for (const [address, value] of [[6, 30], [8, 1], [0xbd, 0xe2], [0xbf, 1], [0xe1, 0]]) base.set(parityPair(value), address);
  const model = new MouseModel({});
  const settings = model.parseBase(base);
  assert.equal(settings.sensorRotationDegrees, -30);
  assert.equal(settings.sensorRotationFlag, 1);
  assert.equal(settings.sensorStaticScan, 0);
  for (const address of [6, 7, 8, 9]) assert.equal(fieldForAddress(address).confidence, 'unknown');
  for (const address of [0xbd, 0xbe, 0xbf, 0xc0, 0xe1, 0xe2]) assert.equal(fieldForAddress(address).confidence, 'candidate');
  assert.match(fieldForAddress(0xe1).name, /20K/);
  base[0xbe] ^= 1;
  assert.equal(model.parseBase(base).sensorRotationDegrees, null);
});

test('experimental angle and scan writes touch only their traced parity pairs', async () => {
  const bytes = new Uint8Array(232).fill(0xa5); const writes = [];
  const model = new MouseModel({ async writeFlash(address, data) { writes.push(address); bytes.set(data, address); } });
  model.refreshSettings = async () => {};
  await assert.rejects(model.setSensorAngle(-30), /Expert writes/);
  await assert.rejects(model.writePair(ADDRESS.SCAN_20K, 1), /Expert writes/);
  assert.deepEqual(writes, []);
  model.expertWrites = true;
  await model.setSensorAngle(-30);
  await model.writePair(ADDRESS.SCAN_20K, 1);
  assert.deepEqual(writes, [0xbd, 0xe1]);
  assert.deepEqual([...bytes.slice(0xbd, 0xc1)], [0xe2, 0x73, 1, 0x54]);
  assert.deepEqual([...bytes.slice(0xe1, 0xe3)], [1, 0x54]);
  for (const address of [6, 7, 8, 9, 0xbc, 0xc1, 0xe0, 0xe3]) assert.equal(bytes[address], 0xa5);
  await assert.rejects(model.setSensorAngle(-31), /integer/);
});
