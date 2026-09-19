import test from 'node:test';
import assert from 'node:assert/strict';
import { MouseModel } from '../src/device-model.js';
import { BACKUP_REGIONS, validateBackupRegions } from '../src/protocol/backup.js';
import { toBase64 } from '../src/codecs.js';
import { lodOptions, physicalButtons } from '../src/ui/f1-controls.js';

const identity = { vendorId: 0x3554, productId: 0xf517, cid: 124, mid: 20 };
function setup() {
  const flash = new Uint8Array(0x1b30).fill(0xa5);
  const writes = [];
  const hid = {
    device: { ...identity },
    async getCurrentProfile() { return 0; },
    async readFlash(address, length) { return flash.slice(address, address + length); },
    async writeFlash(address, bytes) { writes.push({ address, bytes }); flash.set(bytes, address); },
  };
  const model = new MouseModel(hid); model.identity = { ...identity, profile: 0 };
  model.settings = { stageCount: 6, currentStage: 2, buttons: [{ type: 6, param: 0x8023 }] };
  model.refreshSettings = async () => {};
  const backup = { schema: 'attackshark-f1-airi-backup/v1', identity, activeProfile: 0, regions: Object.fromEntries(Object.entries(BACKUP_REGIONS).map(([name, region]) => [name, { address: region.address, data: toBase64(new Uint8Array(region.length).fill(0x5a)) }])) };
  return { model, flash, writes, backup };
}

test('restore validates every region and identity before sending any write', async () => {
  for (const mutate of [
    (b) => { b.regions.macros.address = 0xff00; },
    (b) => { b.regions.macros.data = toBase64(new Uint8Array(10)); },
    (b) => { delete b.identity.mid; },
    (b) => { b.identity.cid = 1; },
    (b) => { b.regions.other = { address: 0x6000, data: 'AAAA' }; },
    (b) => { b.activeProfile = 1; },
  ]) {
    const { model, writes, backup } = setup();
    const changed = structuredClone(backup); mutate(changed);
    await assert.rejects(model.restoreBackup(changed));
    assert.equal(writes.length, 0);
  }
});

test('normal restore preserves candidate/unmapped bytes and restores all hidden firmware slots', async () => {
  const { model, flash, backup } = setup();
  await model.restoreBackup(backup);
  for (const address of [0x06, 0x08, 0x54, 0x78, 0x88, 0xbb, 0xbd, 0xe7]) assert.equal(flash[address], 0xa5);
  for (const address of [0, 0xa, 0x74, 0x77, 0x1b24, 0x1b2f, 0x100, 0x2ff, 0x300, 0x1aff]) assert.equal(flash[address], 0x5a);
});

test('expert restore preserves all backup bytes exactly, including unknown fields', async () => {
  const { model, flash, backup } = setup(); model.expertWrites = true;
  await model.restoreBackup(backup);
  for (const { address, bytes } of validateBackupRegions(backup, identity)) assert.deepEqual(flash.slice(address, address + bytes.length), bytes);
});

test('backup reads current profile instead of cached identity and refuses a profile change', async () => {
  const { model } = setup(); model.identity.profile = 3;
  assert.equal((await model.createBackup()).activeProfile, 0);
  let calls = 0;
  model.hid.getCurrentProfile = async () => calls++ === 0 ? 0 : 1;
  await assert.rejects(model.createBackup(), /Profile changed/);
});

test('candidate scalars, unknown actions and hidden physical index cannot be written normally', async () => {
  const { model, writes } = setup();
  await assert.rejects(model.writePair(6, 1), /Expert writes/);
  await assert.rejects(model.writePair(8, 1), /Expert writes/);
  await assert.rejects(model.writePair(0xbd, 1), /Expert writes/);
  await assert.rejects(model.writePair(1, 1), /Expert writes/);
  await assert.rejects(model.writePair(0xa, 7), /Verified LOD/);
  await assert.rejects(model.setButton(5, 2, 0x100), /Physical button/);
  await assert.rejects(model.setButton(0, 6, 1), /Expert writes/);
  await assert.rejects(model.setButton(0, 4, 0x132), /Expert writes/);
  await model.setButton(0, 6, 0x8023); // Reapplying an opaque binding preserves it.
  assert.equal(writes.length, 0);
  model.expertWrites = true;
  await model.writePair(6, 1);
  assert.equal(writes.length, 1);
});

test('non-integer slots and selecting unused DPI stages reject before I/O', async () => {
  const { model, writes } = setup();
  for (const slot of [NaN, -1, 1.5, 16]) {
    await assert.rejects(model.getMacroSlot(slot));
    await assert.rejects(model.setMacroSlot(slot, {}));
    await assert.rejects(model.getShortcutSlot(slot));
    await assert.rejects(model.setShortcutSlot(slot, []));
  }
  await assert.rejects(model.setCurrentDpiStage(6), /Enabled DPI stage/);
  await assert.rejects(model.setDpi(6, 400), /Enabled DPI stage/);
  await assert.rejects(model.setDpiColor(6, '#ffffff'), /Enabled DPI stage/);
  assert.equal(writes.length, 0);
});

test('rendering LOD and physical controls directly needs no DOM observer repair', () => {
  assert.match(lodOptions(3), /value="3" selected>1.2 mm/);
  assert.match(lodOptions(9), /value="9" selected>Unknown raw 9/);
  assert.match(lodOptions(null), /invalid record/);
  const controls = Array.from({ length: 6 }, (_, index) => ({ index }));
  assert.deepEqual(physicalButtons({ buttons: controls }), controls.slice(0, 5));
  assert.equal(controls.length, 6);
});

test('candidate package MIDs are not promoted to hardware-verified F1 AIR', () => {
  const { model } = setup();
  assert.equal(model.isVerifiedF1Air, true);
  for (const mid of [19, 21, 22]) {
    model.identity.mid = mid;
    assert.equal(model.isVerifiedF1Air, false);
  }
  model.identity.mid = 20; model.hid.device.vendorId = 0;
  assert.equal(model.isVerifiedF1Air, false);
});

test('external profile changes invalidate cached macro and shortcut state', async () => {
  const { model } = setup();
  model.macros.set(0, { stale: true });
  model.shortcuts.set(0, { stale: true });
  model.hid.getBattery = async () => ({ percent: 51 });
  model.hid.getLongRangeMode = async () => false;
  model.hid.getRssi = async () => 42;
  model.hid.getCurrentProfile = async () => 1;
  let changes = 0;
  model.addEventListener('profilechange', () => { changes += 1; });
  await model.refreshIdentity();
  assert.equal(model.identity.profile, 1);
  assert.equal(model.macros.size, 0);
  assert.equal(model.shortcuts.size, 0);
  assert.equal(changes, 1);
});
