import test from 'node:test';
import assert from 'node:assert/strict';
import { F1_AIR_BATTERY_MV, calibratedBatteryPercent } from '../src/battery.js';

test('F1 AIR voltage calibration matches captured vendor 51% at 3890 mV', () => {
  assert.equal(calibratedBatteryPercent(3890, false), 51);
});

test('F1 AIR calibration uses the recovered 21-point profile curve', () => {
  assert.equal(F1_AIR_BATTERY_MV.length, 21);
  assert.deepEqual(F1_AIR_BATTERY_MV, [
    3050, 3170, 3230, 3300, 3600, 3660, 3720,
    3760, 3800, 3840, 3880, 3920, 3940, 3960,
    3980, 4000, 4020, 4040, 4060, 4080, 4110,
  ]);
});

test('F1 AIR calibration clamps the low end and handles full-charge state', () => {
  assert.equal(calibratedBatteryPercent(3000, false), 1);
  assert.equal(calibratedBatteryPercent(3050, false), 1);
  assert.equal(calibratedBatteryPercent(4110, false), 100);
  assert.equal(calibratedBatteryPercent(4110, true), 99);
});

test('F1 AIR calibration preserves vendor 5/15 percent avoidance quirks', () => {
  // Exact points where the recovered DLL bumps calculated 5/15 to 6/16.
  assert.equal(calibratedBatteryPercent(3170, false), 6);
  assert.equal(calibratedBatteryPercent(3300, false), 16);
});
