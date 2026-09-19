export const CONFIDENCE = Object.freeze({
  VERIFIED: 'verified',
  LIKELY: 'likely',
  CANDIDATE: 'candidate',
  UNKNOWN: 'unknown',
});

export const FLASH_FIELDS = Object.freeze([
  { start: 0x0000, end: 0x0001, name: 'Polling rate', confidence: CONFIDENCE.VERIFIED },
  { start: 0x0002, end: 0x0003, name: 'Enabled DPI stages', confidence: CONFIDENCE.VERIFIED },
  { start: 0x0004, end: 0x0005, name: 'Current DPI stage', confidence: CONFIDENCE.VERIFIED },
  { start: 0x0006, end: 0x0007, name: 'Sensor rotation / angle', confidence: CONFIDENCE.CANDIDATE },
  { start: 0x0008, end: 0x0009, name: '20K FPS / static scan', confidence: CONFIDENCE.CANDIDATE },
  { start: 0x000a, end: 0x000b, name: 'Lift-off distance', confidence: CONFIDENCE.VERIFIED },
  { start: 0x000c, end: 0x002b, name: 'Legacy DPI table', confidence: CONFIDENCE.VERIFIED },
  { start: 0x002c, end: 0x004b, name: 'DPI stage colors', confidence: CONFIDENCE.LIKELY },
  { start: 0x004c, end: 0x0053, name: 'DPI indicator mode / brightness / speed / state', confidence: CONFIDENCE.LIKELY },
  { start: 0x0060, end: 0x0073, name: 'Five physical button records', confidence: CONFIDENCE.VERIFIED },
  { start: 0x0074, end: 0x0077, name: 'Internal logical DPI-cycle slot', confidence: CONFIDENCE.VERIFIED },
  { start: 0x00a0, end: 0x00a8, name: 'Decorative light bar', confidence: CONFIDENCE.LIKELY },
  { start: 0x00a9, end: 0x00aa, name: 'Debounce', confidence: CONFIDENCE.LIKELY },
  { start: 0x00ab, end: 0x00ac, name: 'Motion sync', confidence: CONFIDENCE.LIKELY },
  { start: 0x00ad, end: 0x00ae, name: 'Sleep time', confidence: CONFIDENCE.LIKELY },
  { start: 0x00af, end: 0x00b0, name: 'Angle snapping', confidence: CONFIDENCE.LIKELY },
  { start: 0x00b1, end: 0x00b2, name: 'Ripple control', confidence: CONFIDENCE.LIKELY },
  { start: 0x00b3, end: 0x00b4, name: 'Lights off while moving', confidence: CONFIDENCE.LIKELY },
  { start: 0x00b5, end: 0x00b6, name: 'Highest-performance state', confidence: CONFIDENCE.LIKELY },
  { start: 0x00b7, end: 0x00b8, name: 'Highest-performance timer', confidence: CONFIDENCE.LIKELY },
  { start: 0x00b9, end: 0x00ba, name: 'Sensor LP / HP mode', confidence: CONFIDENCE.LIKELY },
  { start: 0x00bd, end: 0x00e7, name: 'Advanced records (semantics unverified)', confidence: CONFIDENCE.CANDIDATE },
  { start: 0x0100, end: 0x02ff, name: 'Shortcut / combo slots', confidence: CONFIDENCE.LIKELY },
  { start: 0x0300, end: 0x1aff, name: 'Macro slots', confidence: CONFIDENCE.LIKELY },
  { start: 0x1b00, end: 0x1b2f, name: 'PAW3955 high-resolution DPI table', confidence: CONFIDENCE.VERIFIED },
]);

export function fieldForAddress(address) {
  if (typeof address !== 'number' && (typeof address !== 'string' || !/^(?:0x[0-9a-f]+|\d+)$/i.test(address))) return null;
  const value = Number(address);
  if (!Number.isInteger(value) || value < 0 || value > 0xffff) return null;
  return FLASH_FIELDS.find((field) => value >= field.start && value <= field.end) ?? null;
}

export function describeAddress(address) {
  const field = fieldForAddress(address);
  return field ? `${field.name} [${field.confidence}]` : 'Unknown / unmapped';
}

export const CAPTURE_PRESETS = Object.freeze({
  base: { label: 'Base settings', address: 0x0000, length: 0x00e8 },
  sensor: { label: 'Sensor + performance', address: 0x0000, length: 0x00e8 },
  buttons: { label: 'Buttons (including internal slot)', address: 0x0060, length: 0x0018 },
  lighting: { label: 'Lighting (colors, effects, light bar)', address: 0x002c, length: 0x0089 },
  highDpi: { label: 'PAW3955 high-resolution DPI', address: 0x1b00, length: 0x0030 },
  shortcuts: { label: 'Shortcut / combo slots', address: 0x0100, length: 0x0200 },
  macros: { label: 'All macro slots', address: 0x0300, length: 0x1800 },
});
