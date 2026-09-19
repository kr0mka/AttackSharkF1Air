import { CAPTURE_PRESETS, fieldForAddress } from './protocol-map.js';
import { validateBytes, validateFlashRange } from './protocol/validation.js';

export const CAPTURE_SCHEMA = 'attackshark-f1-air-capture/v2';
export const COMPARISON_SCHEMA = 'attackshark-f1-air-comparison/v1';

export function cloneBytes(bytes) {
  return validateBytes(bytes ?? []);
}

export function diffBytes(before, after) {
  const a = cloneBytes(before);
  const b = cloneBytes(after);
  const length = Math.max(a.length, b.length);
  const changes = [];
  for (let i = 0; i < length; i += 1) {
    const from = a[i] ?? null;
    const to = b[i] ?? null;
    if (from !== to) {
      changes.push({ offset: i, before: from, after: to });
    }
  }
  return changes;
}

export function summarizeDiff(before, after, baseAddress = 0) {
  return diffBytes(before, after).map((change) => ({
    address: `0x${(baseAddress + change.offset).toString(16).padStart(4, '0')}`,
    before: change.before == null ? '--' : `0x${change.before.toString(16).padStart(2, '0')}`,
    after: change.after == null ? '--' : `0x${change.after.toString(16).padStart(2, '0')}`,
  }));
}

export function makeCapture(label, regions) {
  return {
    schema: 'attackshark-f1-air-capture/v1',
    createdAt: new Date().toISOString(),
    label,
    regions: Object.fromEntries(Object.entries(regions).map(([name, bytes]) => [name, Array.from(bytes)])),
  };
}

export function compareCaptures(before, after) {
  if (before.schema === CAPTURE_SCHEMA || after.schema === CAPTURE_SCHEMA) {
    return compareSnapshots(before, after);
  }
  const result = {};
  const regions = new Set([...Object.keys(before.regions ?? {}), ...Object.keys(after.regions ?? {})]);
  for (const region of regions) {
    result[region] = diffBytes(before.regions?.[region], after.regions?.[region]);
  }
  return result;
}

const IDENTITY_KEYS = ['vendorId', 'productId', 'productName', 'cid', 'mid', 'deviceType'];

export function validateSnapshot(snapshot) {
  if (snapshot?.schema !== CAPTURE_SCHEMA) throw new Error('Unsupported capture schema; v2 metadata is required.');
  if (!Number.isFinite(Date.parse(snapshot.createdAt)) || !Number.isFinite(Date.parse(snapshot.completedAt))) {
    throw new Error('Capture timestamps are missing or invalid.');
  }
  if (!Number.isInteger(snapshot.activeProfile) || snapshot.activeProfile < 0 || snapshot.activeProfile > 3) {
    throw new Error('Capture active profile is missing or invalid.');
  }
  for (const key of IDENTITY_KEYS) {
    const value = snapshot.identity?.[key];
    if (key === 'productName' ? typeof value !== 'string' : !Number.isInteger(value) || value < 0) {
      throw new Error(`Capture device identity is missing or invalid: ${key}.`);
    }
  }
  const regions = Object.entries(snapshot.regions ?? {});
  if (!regions.length || regions.length > 16) throw new Error('Capture needs 1–16 regions.');
  const occupied = new Set();
  for (const [, region] of regions) {
    validateFlashRange(region.address, region.length);
    const bytes = validateBytes(region.bytes);
    if (bytes.length !== region.length) throw new Error('Capture region byte length does not match its range.');
    for (let i = 0; i < region.length; i += 1) {
      const address = region.address + i;
      if (occupied.has(address)) throw new Error('Capture regions overlap.');
      occupied.add(address);
    }
  }
  return snapshot;
}

export function compareSnapshots(before, after) {
  validateSnapshot(before);
  validateSnapshot(after);
  for (const key of IDENTITY_KEYS) {
    if (before.identity[key] !== after.identity[key]) throw new Error(`Capture device mismatch: ${key}.`);
  }
  if (before.activeProfile !== after.activeProfile) throw new Error('Capture profile mismatch. Keep the same onboard profile.');
  const names = Object.keys(before.regions).sort();
  if (JSON.stringify(names) !== JSON.stringify(Object.keys(after.regions).sort())) throw new Error('Capture region mismatch.');
  const diff = [];
  for (const name of names) {
    const a = before.regions[name];
    const b = after.regions[name];
    if (a.address !== b.address || a.length !== b.length) throw new Error(`Capture range mismatch: ${name}.`);
    for (const change of diffBytes(a.bytes, b.bytes)) {
      const address = a.address + change.offset;
      const field = fieldForAddress(address);
      diff.push({ region: name, ...change, address, field: field?.name ?? 'Unknown / unmapped', confidence: field?.confidence ?? 'unknown' });
    }
  }
  return diff.sort((a, b) => a.address - b.address);
}

export function makeComparison(before, after, notes = '') {
  const diff = compareSnapshots(before, after);
  return { schema: COMPARISON_SCHEMA, createdAt: new Date().toISOString(), notes: String(notes), before, after, diff };
}

// Read fresh identity/profile around the operation. Never use the UI's cached
// profile: the official application may have changed it between snapshots.
export async function captureSnapshot(hid, presetKey, { label = '', notes = '', onProgress = () => {} } = {}) {
  const preset = CAPTURE_PRESETS[presetKey];
  if (!preset || !Object.hasOwn(CAPTURE_PRESETS, presetKey)) throw new Error('Unknown capture preset.');
  if (!hid.connected) throw new Error('Connect the mouse before capturing.');
  const device = hid.device;
  const createdAt = new Date().toISOString();
  const handshake = await hid.handshake();
  const online = await hid.getOnline();
  if (!online.online) throw new Error('Mouse is offline or asleep. Wake it before capturing.');
  const activeProfile = await hid.getCurrentProfile();
  const identity = Object.fromEntries(IDENTITY_KEYS.map((key) => [key, device[key] ?? handshake[key]]));
  const bytes = await hid.readFlash(preset.address, preset.length, { onProgress });
  const finalProfile = await hid.getCurrentProfile();
  if (!hid.connected || hid.device !== device) throw new Error('Device disconnected or changed during capture.');
  if (activeProfile !== finalProfile) throw new Error('Profile changed during capture. Discarded mixed snapshot; capture again.');
  return validateSnapshot({
    schema: CAPTURE_SCHEMA, createdAt, completedAt: new Date().toISOString(),
    label: String(label), notes: String(notes), preset: presetKey, identity, activeProfile,
    regions: { [presetKey]: { label: preset.label, address: preset.address, length: preset.length, bytes: Array.from(bytes) } },
  });
}

export function parseCaptureFile(text) {
  if (typeof text !== 'string' || text.length > 2_000_000) throw new Error('Capture file is too large.');
  const value = JSON.parse(text);
  if (value.schema === COMPARISON_SCHEMA) {
    // Recompute labels and changes; never trust an imported normalized diff.
    return { before: validateSnapshot(value.before), after: validateSnapshot(value.after), comparison: makeComparison(value.before, value.after, value.notes) };
  }
  return { before: validateSnapshot(value), after: null, comparison: null };
}
