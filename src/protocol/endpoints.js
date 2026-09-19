import { OPCODE } from '../constants.js';

export const ENDPOINT_GROUPS = Object.freeze({
  versions: [
    { opcode: OPCODE.READ_VERSION, label: 'Normal version endpoint (0x12)' },
    { opcode: OPCODE.GET_DONGLE_VERSION, label: 'Receiver version endpoint (0x1D)' },
    { opcode: OPCODE.GET_SLAVE_VERSION, label: 'Wireless slave-version endpoint (0xB3)' },
  ],
  receiver: [
    { opcode: OPCODE.GET_RECEIVER_INDICATOR, label: 'Receiver indicator raw state (0x2D)' },
    { opcode: OPCODE.GET_RECEIVER_RGB, label: 'Receiver RGB raw state (0x19)' },
  ],
});

// Only explicitly known read endpoints can be probed. This is intentionally
// separate from firmware update/bootloader commands and profile flash captures.
export async function captureEndpoints(hid, group, notes = '') {
  if (!Object.hasOwn(ENDPOINT_GROUPS, group)) throw new Error('Unknown read-only endpoint group.');
  if (!hid.connected) throw new Error('Connect the mouse before probing endpoints.');
  const device = hid.device;
  const createdAt = new Date().toISOString();
  const handshake = await hid.handshake();
  const activeProfile = await hid.getCurrentProfile();
  const responses = [];
  for (const endpoint of ENDPOINT_GROUPS[group]) {
    try {
      const raw = await hid.command(endpoint.opcode);
      responses.push({ ...endpoint, status: 'ok', body: Array.from(raw) });
    } catch (error) {
      responses.push({ ...endpoint, status: 'error', error: String(error.message ?? error), body: null });
    }
  }
  const finalProfile = await hid.getCurrentProfile();
  if (!hid.connected || hid.device !== device || activeProfile !== finalProfile) throw new Error('Device or profile changed during endpoint capture.');
  return {
    schema: 'attackshark-f1-air-endpoints/v1', createdAt, completedAt: new Date().toISOString(),
    group, notes: String(notes), reportId: 8, activeProfile,
    identity: { vendorId: device.vendorId, productId: device.productId, productName: device.productName, cid: handshake.cid, mid: handshake.mid, deviceType: handshake.deviceType },
    responses,
  };
}
