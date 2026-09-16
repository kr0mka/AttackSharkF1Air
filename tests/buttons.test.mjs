import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BUTTON_ACTIONS,
  BUTTON_COUNT,
  MOUSE_BUTTON_NAMES,
  PHYSICAL_BUTTON_COUNT,
} from '../src/constants.js';
import { decodeButtonAction } from '../src/codecs.js';

test('F1 AIR exposes five physical controls but preserves six flash records', () => {
  assert.equal(PHYSICAL_BUTTON_COUNT, 5);
  assert.equal(BUTTON_COUNT, 6);
  assert.deepEqual(MOUSE_BUTTON_NAMES.slice(0, PHYSICAL_BUTTON_COUNT), [
    'Left', 'Right', 'Wheel click', 'Forward', 'Backward',
  ]);
  assert.equal(MOUSE_BUTTON_NAMES[5], 'Internal DPI slot');
});

test('captured default profile has hidden sixth DPI-cycle record', () => {
  const captured = [
    [0x01, 0x01, 0x00, 0x53],
    [0x01, 0x02, 0x00, 0x52],
    [0x01, 0x04, 0x00, 0x50],
    [0x01, 0x08, 0x00, 0x4c],
    [0x01, 0x10, 0x00, 0x44],
    [0x02, 0x01, 0x00, 0x52],
  ].map((x) => Uint8Array.from(x));

  const decoded = captured.map(decodeButtonAction);
  assert.deepEqual(decoded, [
    { type: 0x01, param: 0x0100 },
    { type: 0x01, param: 0x0200 },
    { type: 0x01, param: 0x0400 },
    { type: 0x01, param: 0x0800 },
    { type: 0x01, param: 0x1000 },
    { type: 0x02, param: 0x0100 },
  ]);
});

test('F1 AIR vendor semantics map side-button bits forward then backward', () => {
  const forward = BUTTON_ACTIONS.find((x) => x.type === 0x01 && x.param === 0x0800);
  const backward = BUTTON_ACTIONS.find((x) => x.type === 0x01 && x.param === 0x1000);
  assert.equal(forward?.key, 'forward');
  assert.equal(forward?.label, 'Forward');
  assert.equal(backward?.key, 'back');
  assert.equal(backward?.label, 'Backward');
});
