import test from 'node:test';
import assert from 'node:assert/strict';
import { BODY_CHECKSUM_TARGET, OPCODE, REPORT_ID } from '../src/constants.js';
import {
  checksumValid,
  decodeButtonAction,
  decodeHighResDpi,
  decodeLegacyDpi,
  decodeMacro,
  decodeParityPair,
  encodeButtonAction,
  encodeHighResDpi,
  encodeLegacyDpi,
  encodeMacro,
  decodeLightBar,
  encodeLightBar,
  decodeShortcut,
  encodeShortcut,
  parityPair,
} from '../src/codecs.js';
import { CompXDevice, packetBody, packetChecksumValid, rawCommandBody } from '../src/protocol.js';

const sum = (bytes) => [...bytes].reduce((a,b)=>(a+b)&0xff,0);

test('packet checksum includes report id and totals 0x55', () => {
  const body = packetBody(OPCODE.READ_FLASH, { address: 0x1b00, length: 6 });
  assert.equal(body.length, 16);
  assert.equal(sum(body), BODY_CHECKSUM_TARGET);
  assert.equal((REPORT_ID + sum(body)) & 0xff, 0x55);
  assert.equal(packetChecksumValid(body), true);
});

test('generic payload starts at body byte 5', () => {
  const body = rawCommandBody(OPCODE.SET_LONG_RANGE, [1]);
  assert.equal(body[0], OPCODE.SET_LONG_RANGE);
  assert.equal(body[4], 1);
  assert.equal(body[5], 1);
});

test('parity pair sums to 0x55', () => {
  for (const value of [0,1,8,64,169,255]) {
    const bytes = parityPair(value);
    assert.equal(checksumValid(bytes), true);
    assert.equal(decodeParityPair(bytes), value);
  }
});

test('F1 high-resolution DPI record round-trips exact values', () => {
  for (const dpi of [1,400,800,1200,3200,42000,42002,60000]) {
    const raw = encodeHighResDpi(dpi);
    assert.equal(raw.length, 6);
    assert.equal(checksumValid(raw), true);
    const stored = raw[0] | (raw[1] << 8);
    assert.equal(stored, dpi - 1);
    assert.deepEqual(decodeHighResDpi(raw), { x:dpi, y:dpi, dpi, flag:0x11 });
  }
});

test('legacy DPI mirror rounds to 50-DPI units', () => {
  const raw = encodeLegacyDpi(1337);
  assert.equal(raw.length, 4);
  assert.equal(decodeLegacyDpi(raw), 1350);
});

test('button block round-trips', () => {
  const raw = encodeButtonAction(0x01, 0x1000);
  assert.equal(checksumValid(raw), true);
  assert.deepEqual(decodeButtonAction(raw), { type:0x01, param:0x1000 });
});

test('macro layout round-trips recovered 5-byte events', () => {
  const macro = {
    name:'Test',
    events:[
      {kind:'key-down',code:1,data1:4,data2:0,delayMs:12},
      {kind:'key-up',code:1,data1:4,data2:0,delayMs:34},
      {kind:'mouse',code:4,data1:0,data2:1,delayMs:50},
    ],
  };
  const raw=encodeMacro(macro);
  const decoded=decodeMacro(raw);
  assert.equal(decoded.valid,true);
  assert.equal(decoded.name,'Test');
  assert.deepEqual(decoded.events,macro.events);
});


test('light-bar record round-trips', () => {
  const raw = encodeLightBar({ mode: 3, brightness: 177, speed: 4, color: '#12abef', offTime: 6 });
  assert.equal(raw.length, 9);
  const decoded = decodeLightBar(raw);
  assert.equal(decoded.valid, true);
  assert.deepEqual(decoded, { valid:true, mode:3, brightness:177, speed:4, color:'#12abef', offTime:6 });
});

test('shortcut compact events round-trip', () => {
  const events = [
    {kind:'key-down',code:1,data1:4,data2:0},
    {kind:'key-up',code:1,data1:4,data2:0},
  ];
  const raw = encodeShortcut(events);
  const decoded = decodeShortcut(raw);
  assert.equal(decoded.valid, true);
  assert.deepEqual(decoded.events, events);
});

test('macro and shortcut editing preserve opaque padding and bytes beyond the new checksum', () => {
  const original = new Uint8Array(384).fill(0xa5);
  const events = [{ kind: 'key-down', code: 1, usage: 4 }, { kind: 'key-up', code: 1, usage: 4 }];
  const encoded = encodeMacro({ name: 'X', events }, { original });
  assert.deepEqual(encoded.slice(2, 31), original.slice(2, 31));
  assert.deepEqual(encoded.slice(43), original.slice(43));
  assert.equal(decodeMacro(encoded).valid, true);
  assert.equal(decodeMacro(encoded).name, 'X');
  const shortcutOriginal = new Uint8Array(32).fill(0x5a);
  const shortcut = encodeShortcut(events, { original: shortcutOriginal });
  assert.deepEqual(shortcut.slice(8), shortcutOriginal.slice(8));
  assert.equal(decodeShortcut(shortcut).valid, true);
});

test('receiver-marker command keeps 0x0A marker instead of payload length', () => {
  const body = rawCommandBody(OPCODE.SET_RECEIVER_INDICATOR, [2, 3, 4], { marker: 0x0a });
  assert.equal(body[4], 0x0a);
  assert.deepEqual([...body.slice(5, 8)], [2,3,4]);
  assert.equal(packetChecksumValid(body), true);
});

test('wireless slave-version opcode recovered from vendor DLL', () => {
  assert.equal(OPCODE.GET_SLAVE_VERSION, 0xb3);
});


test('request/response exchanges are serialized for the receiver', async () => {
  const device = new CompXDevice();
  const sent = [];
  const resolvers = [];
  device.waitFor = () => new Promise((resolve) => resolvers.push(resolve));
  device._sendNow = async (_body, note) => { sent.push(note); };

  const first = device.exchange(new Uint8Array(16), () => true, 900, 'first');
  const second = device.exchange(new Uint8Array(16), () => true, 900, 'second');
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(sent, ['first']);

  resolvers[0](new Uint8Array(16));
  await first;
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(sent, ['first', 'second']);

  resolvers[1](new Uint8Array(16));
  await second;
});
