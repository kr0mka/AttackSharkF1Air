export const F1_AIR_LOD_LEVELS = Object.freeze([
  Object.freeze({ raw: 1, mm: 0.7, pair: [0x01, 0x54] }),
  Object.freeze({ raw: 2, mm: 0.9, pair: [0x02, 0x53] }),
  Object.freeze({ raw: 3, mm: 1.2, pair: [0x03, 0x52] }),
  Object.freeze({ raw: 4, mm: 1.4, pair: [0x04, 0x51] }),
  Object.freeze({ raw: 5, mm: 1.6, pair: [0x05, 0x50] }),
]);

export function lodLevelForRaw(raw) {
  return F1_AIR_LOD_LEVELS.find((level) => level.raw === Number(raw)) ?? null;
}

export function lodRawForMm(mm) {
  const value = Number(mm);
  return F1_AIR_LOD_LEVELS.find((level) => level.mm === value)?.raw ?? null;
}
