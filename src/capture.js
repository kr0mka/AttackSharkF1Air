export function cloneBytes(bytes) {
  return Uint8Array.from(bytes ?? []);
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
  const result = {};
  const regions = new Set([...Object.keys(before.regions ?? {}), ...Object.keys(after.regions ?? {})]);
  for (const region of regions) {
    result[region] = diffBytes(before.regions?.[region], after.regions?.[region]);
  }
  return result;
}
