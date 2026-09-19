// Installed desktop angle handler stores a signed degree byte at 0xBD,
// with a separate companion flag pair at 0xBF. Physical behavior awaits capture.
export function encodeAngle(degrees) {
  if (!Number.isInteger(degrees) || degrees < -30 || degrees > 30) throw new Error('Mouse angle must be an integer from −30° to +30°.');
  return degrees & 0xff;
}

export function decodeAngle(raw) {
  if (!Number.isInteger(raw) || raw < 0 || raw > 255) return null;
  const degrees = raw > 127 ? raw - 256 : raw;
  return degrees >= -30 && degrees <= 30 ? degrees : null;
}
