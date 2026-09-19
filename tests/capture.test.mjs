import test from 'node:test';
import assert from 'node:assert/strict';
import { CAPTURE_SCHEMA, captureSnapshot, compareSnapshots, diffBytes, makeComparison, parseCaptureFile, validateSnapshot } from '../src/capture.js';
import { CAPTURE_PRESETS, FLASH_FIELDS, fieldForAddress } from '../src/protocol-map.js';
import { renderCaptureLab, createCaptureLabState } from '../src/ui/capture-lab.js';

const identity = { vendorId: 0x3554, productId: 0xf517, productName: 'ATTACK SHARK Mouse', cid: 124, mid: 20, deviceType: 5 };
function snapshot(address = 0x000a, bytes = [1, 0x54]) {
  return { schema: CAPTURE_SCHEMA, createdAt: '2026-09-19T10:00:00.000Z', completedAt: '2026-09-19T10:00:01.000Z', identity: { ...identity }, activeProfile: 0, regions: { sensor: { address, length: bytes.length, bytes } } };
}

test('capture diff uses absolute addresses and verified LOD labels, including checksum byte', () => {
  const before = snapshot();
  const after = snapshot(0xa, [2, 0x53]);
  assert.deepEqual(compareSnapshots(before, after), [
    { region: 'sensor', offset: 0, address: 0xa, before: 1, after: 2, field: 'Lift-off distance', confidence: 'verified' },
    { region: 'sensor', offset: 1, address: 0xb, before: 0x54, after: 0x53, field: 'Lift-off distance', confidence: 'verified' },
  ]);
  assert.deepEqual(compareSnapshots(before, structuredClone(before)), []);
});

test('candidate advanced data and unmapped bytes are retained without invented semantics', () => {
  assert.equal(compareSnapshots(snapshot(0xbd, [0]), snapshot(0xbd, [1]))[0].confidence, 'candidate');
  assert.deepEqual(compareSnapshots(snapshot(0xbb, [0]), snapshot(0xbb, [255]))[0], {
    region: 'sensor', offset: 0, address: 0xbb, before: 0, after: 255, field: 'Unknown / unmapped', confidence: 'unknown',
  });
});

test('comparison rejects mismatched identity, profiles, region names and ranges', () => {
  const before = snapshot();
  for (const key of Object.keys(identity)) {
    const after = snapshot();
    after.identity[key] = key === 'productName' ? 'other mouse' : identity[key] + 1;
    assert.throws(() => compareSnapshots(before, after), /device mismatch/);
  }
  const after = snapshot(); after.activeProfile = 1;
  assert.throws(() => compareSnapshots(before, after), /profile mismatch/);
  assert.throws(() => compareSnapshots(before, snapshot(0xc)), /range mismatch/);
  assert.throws(() => compareSnapshots(before, snapshot(0xa, [1])), /range mismatch/);
  const renamed = snapshot(); renamed.regions.other = renamed.regions.sensor; delete renamed.regions.sensor;
  assert.throws(() => compareSnapshots(before, renamed), /region mismatch/);
});

test('capture import validates bytes/ranges and does not trust imported diffs', () => {
  for (const bytes of [[-1], [256], [1.5], ['1'], [null], new Array(2)]) {
    assert.throws(() => validateSnapshot(snapshot(0, bytes)), /integer bytes/);
  }
  for (const address of [-1, 1.5, 65536, null, '0x00']) assert.throws(() => validateSnapshot(snapshot(address)));
  assert.throws(() => validateSnapshot(snapshot(65535)), /Flash range/);
  const short = snapshot(); short.regions.sensor.length = 3;
  assert.throws(() => validateSnapshot(short), /byte length/);
  const overlap = snapshot(); overlap.regions.other = structuredClone(overlap.regions.sensor);
  assert.throws(() => validateSnapshot(overlap), /overlap/);
  const missing = snapshot(); delete missing.identity.cid;
  assert.throws(() => validateSnapshot(missing), /identity/);
  const comparison = makeComparison(snapshot(), snapshot(0xa, [2, 0x53]), 'LOD 0.7 → 0.9 mm');
  comparison.diff = [{ address: 0, field: 'fabricated' }];
  const imported = parseCaptureFile(JSON.stringify(comparison));
  assert.equal(imported.comparison.diff[0].address, 0xa);
  assert.equal(imported.comparison.notes, 'LOD 0.7 → 0.9 mm');
  assert.throws(() => parseCaptureFile('{"schema":"attackshark-f1-air-capture/v1"}'), /Unsupported/);
});

test('low-level byte diff distinguishes missing data from zero', () => {
  assert.deepEqual(diffBytes([0, 1], [0]), [{ offset: 1, before: 1, after: null }]);
});

test('address registry covers boundaries and rejects coercion of invalid addresses', () => {
  for (const field of FLASH_FIELDS) {
    assert.equal(fieldForAddress(field.start), field);
    assert.equal(fieldForAddress(field.end), field);
  }
  for (const address of [null, undefined, '', ' ', [], false, -1, NaN, 1.5, 65536, '0x0ag']) assert.equal(fieldForAddress(address), null);
  assert.equal(fieldForAddress('0x0074').name, 'Internal logical DPI-cycle slot');
  assert.equal(fieldForAddress(0x78), null);
  assert.equal(fieldForAddress(0x1b30), null);
});

test('presets cover all hidden records, colors, and moving-light-off', () => {
  assert.equal(CAPTURE_PRESETS.base.length, 232);
  assert.equal(CAPTURE_PRESETS.buttons.address + CAPTURE_PRESETS.buttons.length, 0x78);
  assert.equal(CAPTURE_PRESETS.highDpi.length, 8 * 6);
  assert.equal(CAPTURE_PRESETS.macros.length, 16 * 384);
  assert.equal(CAPTURE_PRESETS.shortcuts.length, 16 * 32);
  assert.equal(CAPTURE_PRESETS.lighting.address, 0x2c);
  assert.equal(CAPTURE_PRESETS.lighting.address + CAPTURE_PRESETS.lighting.length, 0xb5);
});

function fakeHid(profiles = [2, 2]) {
  const calls = [];
  const hid = {
    connected: true, device: { ...identity },
    async handshake() { calls.push('handshake'); return { cid: 124, mid: 20, deviceType: 5 }; },
    async getOnline() { calls.push('online'); return { online: true }; },
    async getCurrentProfile() { calls.push('profile'); return profiles.shift(); },
    async readFlash(address, length, { onProgress }) { calls.push(['read', address, length]); onProgress(length, length); return new Uint8Array(length).fill(0xa5); },
    async writeFlash() { assert.fail('Capture must never write flash'); },
  };
  return { hid, calls };
}

test('live capture reads fresh profile before/after, sequentially, and preserves exact bytes', async () => {
  const { hid, calls } = fakeHid();
  const capture = await captureSnapshot(hid, 'buttons');
  assert.equal(capture.activeProfile, 2);
  assert.deepEqual(capture.identity, identity);
  assert.deepEqual(capture.regions.buttons.bytes, Array(24).fill(0xa5));
  assert.deepEqual(calls, ['handshake', 'online', 'profile', ['read', 0x60, 24], 'profile']);
  assert.equal(capture.regions.buttons.address, 0x60);
});

test('live capture rejects profile changes, offline mouse, disconnects, and truncated reads', async () => {
  await assert.rejects(captureSnapshot(fakeHid([0, 1]).hid, 'base'), /Profile changed/);
  const offline = fakeHid(); offline.hid.getOnline = async () => ({ online: false });
  await assert.rejects(captureSnapshot(offline.hid, 'base'), /offline/);
  assert.equal(offline.calls.includes('profile'), false);
  const lost = fakeHid(); lost.hid.readFlash = async () => { lost.hid.connected = false; return new Uint8Array(232); };
  await assert.rejects(captureSnapshot(lost.hid, 'base'), /disconnected/);
  const short = fakeHid(); short.hid.readFlash = async () => new Uint8Array(10);
  await assert.rejects(captureSnapshot(short.hid, 'base'), /byte length/);
  await assert.rejects(captureSnapshot(fakeHid().hid, 'toString'), /Unknown capture preset/);
});

test('capture lab is useful disconnected, escapes imported notes, and distinguishes zero differences', () => {
  const state = createCaptureLabState();
  state.notes = '<img src=x onerror=alert(1)>';
  state.before = snapshot(); state.after = snapshot(); state.comparison = makeComparison(state.before, state.after);
  const html = renderCaptureLab(state, false);
  assert.match(html, /0 changed bytes/);
  assert.match(html, /id="capture-before" disabled/);
  assert.match(html, /id="capture-export" >Export JSON/);
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /&lt;img/);
});
