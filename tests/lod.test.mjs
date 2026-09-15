import test from 'node:test';
import assert from 'node:assert/strict';
import { F1_AIR_LOD_LEVELS, lodLevelForRaw, lodRawForMm } from '../src/lod.js';

test('verified F1 AIR LOD mapping matches hardware captures', () => {
  assert.deepEqual(
    F1_AIR_LOD_LEVELS.map(({ raw, mm, pair }) => ({ raw, mm, pair })),
    [
      { raw: 1, mm: 0.7, pair: [0x01, 0x54] },
      { raw: 2, mm: 0.9, pair: [0x02, 0x53] },
      { raw: 3, mm: 1.2, pair: [0x03, 0x52] },
      { raw: 4, mm: 1.4, pair: [0x04, 0x51] },
      { raw: 5, mm: 1.6, pair: [0x05, 0x50] },
    ],
  );
  assert.equal(lodLevelForRaw(3)?.mm, 1.2);
  assert.equal(lodRawForMm(1.6), 5);
  assert.equal(lodLevelForRaw(0), null);
});
