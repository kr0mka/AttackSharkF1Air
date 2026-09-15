// Paste this module into a Chromium DevTools console only after importing it through a local page,
// or use the built-in Diagnostics packet log. This helper is intentionally read-oriented.
// It does not monkey-patch browser internals or transmit any packets itself.

export function attachHidLogger(device, { reportId = 8, onPacket = console.log } = {}) {
  const handler = (event) => {
    if (event.reportId !== reportId) return;
    const bytes = new Uint8Array(event.data.buffer, event.data.byteOffset, event.data.byteLength);
    onPacket({ direction: 'in', time: performance.now(), reportId: event.reportId, bytes: Uint8Array.from(bytes) });
  };
  device.addEventListener('inputreport', handler);
  return () => device.removeEventListener('inputreport', handler);
}

export function formatPacket({ direction, reportId, bytes }) {
  const body = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join(' ').toUpperCase();
  return `${direction.toUpperCase()} RID=${reportId} ${body}`;
}
