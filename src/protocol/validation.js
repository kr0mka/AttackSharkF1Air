// Address arithmetic must never wrap the transport's 16-bit flash address.
export function validateFlashRange(address, length) {
  if (!Number.isInteger(address) || !Number.isInteger(length) || address < 0 ||
      address > 0xffff || length < 1 || address + length > 0x10000) {
    throw new Error('Flash range requires an integer address and positive length within 0x0000–0xFFFF.');
  }
}

export function validateBytes(bytes) {
  if (!(Array.isArray(bytes) || bytes instanceof Uint8Array) ||
      Array.from(bytes).some((b) => !Number.isInteger(b) || b < 0 || b > 255)) {
    throw new Error('Expected an array of integer bytes (0–255).');
  }
  return Uint8Array.from(bytes);
}
