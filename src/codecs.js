import {
  CHECKSUM_TARGET,
  DPI_STAGE_COUNT,
  F1_AIR_PROFILE,
  MACRO_SLOT_SIZE,
  SHORTCUT_SLOT_SIZE,
} from './constants.js';

export function u8(value) {
  return Number(value) & 0xff;
}

export function checksumFor(bytes, target = CHECKSUM_TARGET) {
  const sum = [...bytes].reduce((acc, value) => (acc + u8(value)) & 0xff, 0);
  return (target - sum) & 0xff;
}

export function checksumValid(bytes, target = CHECKSUM_TARGET) {
  return ([...bytes].reduce((acc, value) => (acc + u8(value)) & 0xff, 0) & 0xff) === target;
}

export function parityPair(value) {
  const first = u8(value);
  return Uint8Array.of(first, checksumFor([first]));
}

export function decodeParityPair(bytes, fallback = null) {
  if (!bytes || bytes.length < 2 || !checksumValid(bytes.slice(0, 2))) return fallback;
  return u8(bytes[0]);
}

export function checksummedBlock(payload) {
  const bytes = Uint8Array.from(payload, u8);
  return Uint8Array.from([...bytes, checksumFor(bytes)]);
}

export function hex(bytes, separator = ' ') {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join(separator).toUpperCase();
}

export function parseHex(text) {
  const clean = String(text).replace(/0x/gi, '').replace(/[^a-fA-F0-9]/g, '');
  if (clean.length % 2) throw new Error('Hex input must contain whole bytes.');
  return Uint8Array.from(clean.match(/.{2}/g)?.map((v) => Number.parseInt(v, 16)) ?? []);
}

// Legacy CompX DPI storage: 50-DPI units, 10-bit value, duplicated low byte.
export function encodeLegacyDpi(dpi) {
  const clamped = Math.min(51200, Math.max(50, Math.round(Number(dpi) / 50) * 50));
  const raw = Math.max(0, Math.min(1023, clamped / 50 - 1));
  const lo = raw & 0xff;
  const hi = (raw >> 8) & 0x03;
  const first3 = Uint8Array.of(lo, lo, (hi << 2) | (hi << 6));
  return checksummedBlock(first3);
}

export function decodeLegacyDpi(block) {
  if (!block || block.length < 4 || !checksumValid(block.slice(0, 4))) return null;
  const lo = block[0];
  const hi = (block[2] >> 2) & 0x03;
  return 50 * ((lo | (hi << 8)) + 1);
}

// F1 AIR / PAW3955 high-resolution table recovered from the vendor parser.
// Layout: X DPI LE16, Y DPI LE16, mode/flag, checksum.
export function encodeHighResDpi(dpi, flag = F1_AIR_PROFILE.dpi.highResFlag) {
  const value = Math.max(F1_AIR_PROFILE.dpi.min, Math.min(F1_AIR_PROFILE.dpi.max, Math.round(Number(dpi))));
  // PAW3955 high-resolution register stores CPI as (requested DPI - 1).
  const rawValue = value - 1;
  const payload = Uint8Array.of(rawValue & 0xff, (rawValue >> 8) & 0xff, rawValue & 0xff, (rawValue >> 8) & 0xff, flag);
  return checksummedBlock(payload);
}

export function decodeHighResDpi(block) {
  if (!block || block.length < 6 || !checksumValid(block.slice(0, 6))) return null;
  const xRaw = block[0] | (block[1] << 8);
  const yRaw = block[2] | (block[3] << 8);
  const x = xRaw + 1;
  const y = yRaw + 1;
  return { x, y, dpi: x === y ? x : Math.round((x + y) / 2), flag: block[4] };
}

export function encodeRgb(hexColor) {
  const value = String(hexColor).replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(value)) throw new Error('Expected an RGB color in #RRGGBB format.');
  return Uint8Array.of(
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  );
}

export function decodeRgb(bytes) {
  if (!bytes || bytes.length < 3) return '#ffffff';
  return `#${[...bytes.slice(0, 3)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

export function encodeDpiColor(color, enabled = true) {
  const rgb = encodeRgb(color);
  // Four-byte per-stage record seen by ProtocolDataParser: RGB + checksum.
  // Disabled colors are represented as black while preserving a valid record.
  return checksummedBlock(enabled ? rgb : Uint8Array.of(0, 0, 0));
}

export function decodeDpiColor(block) {
  if (!block || block.length < 4 || !checksumValid(block.slice(0, 4))) return null;
  return decodeRgb(block.slice(0, 3));
}

export function encodeButtonAction(type, param = 0) {
  const first3 = Uint8Array.of(u8(type), (param >> 8) & 0xff, param & 0xff);
  return checksummedBlock(first3);
}

export function decodeButtonAction(block) {
  if (!block || block.length < 4 || !checksumValid(block.slice(0, 4))) return null;
  return { type: block[0], param: (block[1] << 8) | block[2] };
}

export function encodeLightBar({ mode = 0, brightness = 128, speed = 3, color = '#ffffff', offTime = 1 } = {}) {
  const rgb = encodeRgb(color);
  const head = checksummedBlock(Uint8Array.of(u8(mode), u8(brightness), u8(speed), ...rgb));
  const tail = parityPair(offTime);
  return Uint8Array.of(...head, ...tail);
}

export function decodeLightBar(block) {
  if (!block || block.length < 9) return null;
  const head = block.slice(0, 7);
  const off = block.slice(7, 9);
  return {
    valid: checksumValid(head) && checksumValid(off),
    mode: block[0],
    brightness: block[1],
    speed: block[2],
    color: decodeRgb(block.slice(3, 6)),
    offTime: decodeParityPair(off),
  };
}

function macroHeader(event) {
  const code = u8(event.code ?? 0) & 0x0f;
  if (event.kind === 'key-down') return 0x80 | code;
  if (event.kind === 'key-up') return 0x40 | code;
  return code;
}

export function encodeMacro({ name = 'Macro', events = [] } = {}, { original = null } = {}) {
  if (original && original.length !== MACRO_SLOT_SIZE) throw new Error('Original macro slot must contain 384 bytes.');
  const out = original ? Uint8Array.from(original) : new Uint8Array(MACRO_SLOT_SIZE);
  const encodedName = new TextEncoder().encode(String(name));
  const nameBytes = encodedName.slice(0, 30);
  const safeEvents = events.slice(0, 70);
  out[0] = Math.max(1, nameBytes.length);
  out.set(nameBytes.length ? nameBytes : Uint8Array.of(0x4d), 1);
  out[31] = safeEvents.length;

  let cursor = 32;
  for (const event of safeEvents) {
    out[cursor] = macroHeader(event);
    out[cursor + 1] = u8(event.data1 ?? event.usage ?? 0);
    out[cursor + 2] = u8(event.data2 ?? 0);
    const delay = Math.max(0, Math.min(65535, Math.round(Number(event.delayMs ?? 0))));
    out[cursor + 3] = (delay >> 8) & 0xff;
    out[cursor + 4] = delay & 0xff;
    cursor += 5;
  }
  out[cursor] = checksumFor(out.slice(0, cursor));
  return out;
}

export function decodeMacro(raw) {
  if (!raw || raw.length < 33) return { name: '', events: [], valid: false };
  const nameLength = Math.min(30, raw[0]);
  const count = Math.min(70, raw[31]);
  const checksumIndex = 32 + count * 5;
  if (checksumIndex >= raw.length) return { name: '', events: [], valid: false };
  const name = new TextDecoder().decode(raw.slice(1, 1 + nameLength)).replace(/\0+$/, '');
  const events = [];
  for (let i = 0; i < count; i += 1) {
    const p = 32 + i * 5;
    const header = raw[p];
    const kind = (header & 0x80) ? 'key-down' : (header & 0x40) ? 'key-up' : 'mouse';
    events.push({
      kind,
      code: header & 0x0f,
      data1: raw[p + 1],
      data2: raw[p + 2],
      delayMs: (raw[p + 3] << 8) | raw[p + 4],
    });
  }
  return { name, events, valid: checksumValid(raw.slice(0, checksumIndex + 1)) };
}

export function encodeShortcut(events = [], { original = null } = {}) {
  if (original && original.length !== SHORTCUT_SLOT_SIZE) throw new Error('Original shortcut slot must contain 32 bytes.');
  const out = original ? Uint8Array.from(original) : new Uint8Array(SHORTCUT_SLOT_SIZE);
  const safe = events.slice(0, 6);
  out[0] = safe.length;
  let cursor = 1;
  for (const event of safe) {
    out[cursor] = macroHeader(event);
    out[cursor + 1] = u8(event.data1 ?? event.usage ?? 0);
    out[cursor + 2] = u8(event.data2 ?? 0);
    cursor += 3;
  }
  out[cursor] = checksumFor(out.slice(0, cursor));
  return out;
}

export function decodeShortcut(raw) {
  if (!raw?.length) return { events: [], valid: false };
  const count = Math.min(6, raw[0]);
  const end = 1 + count * 3;
  if (end >= raw.length) return { events: [], valid: false };
  const events = [];
  for (let i = 0; i < count; i += 1) {
    const p = 1 + i * 3;
    const header = raw[p];
    events.push({
      kind: (header & 0x80) ? 'key-down' : (header & 0x40) ? 'key-up' : 'mouse',
      code: header & 0x0f,
      data1: raw[p + 1],
      data2: raw[p + 2],
    });
  }
  return { events, valid: checksumValid(raw.slice(0, end + 1)) };
}

export function splitDpiRecords(raw) {
  return Array.from({ length: DPI_STAGE_COUNT }, (_, i) => raw.slice(i * 4, i * 4 + 4));
}

export function toBase64(bytes) {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

export function fromBase64(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}
