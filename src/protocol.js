import {
  ALL_PRODUCT_IDS,
  BODY_CHECKSUM_TARGET,
  BODY_SIZE,
  OPCODE,
  REPORT_ID,
  VENDOR_ID,
} from './constants.js';
import { calibratedBatteryPercent } from './battery.js';
import { checksumFor, hex, u8 } from './codecs.js';
import { validateBytes, validateFlashRange } from './protocol/validation.js';

export function packetBody(opcode, { address = 0, length = 0, payload = [], feature = false } = {}) {
  const body = new Uint8Array(BODY_SIZE);
  body[0] = u8(opcode);
  body[1] = 0;
  body[2] = (address >> 8) & 0xff;
  body[3] = address & 0xff;
  body[4] = u8(length) | (feature ? 0x80 : 0);
  body.set(Uint8Array.from(payload).slice(0, 10), 5);
  body[15] = checksumFor(body.slice(0, 15), BODY_CHECKSUM_TARGET);
  return body;
}

export function rawCommandBody(opcode, payload = [], { marker = null, feature = false } = {}) {
  const body = new Uint8Array(BODY_SIZE);
  body[0] = u8(opcode);
  const field4 = marker == null ? Math.min(payload.length, 10) : marker;
  body[4] = u8(field4) | (feature ? 0x80 : 0);
  body.set(Uint8Array.from(payload).slice(0, 10), 5);
  body[15] = checksumFor(body.slice(0, 15), BODY_CHECKSUM_TARGET);
  return body;
}

export function packetChecksumValid(body) {
  if (!body || body.length !== BODY_SIZE) return false;
  return ([...body.slice(0, BODY_SIZE)].reduce((a, b) => (a + b) & 0xff, 0) & 0xff) === BODY_CHECKSUM_TARGET;
}

export class CompXDevice extends EventTarget {
  constructor() {
    super();
    this.device = null;
    this.waiters = [];
    this.log = [];
    this.maxLog = 500;
    // The F1 AIR 8K receiver only reliably services one request/response
    // transaction at a time. The vendor DLL serializes these exchanges too.
    this._exchangeTail = Promise.resolve();
    this._connectionGeneration = 0;
    this._inputHandler = this._onInputReport.bind(this);
  }

  get connected() {
    return Boolean(this.device?.opened);
  }

  async request() {
    if (!('hid' in navigator)) {
      throw new Error('WebHID is unavailable. Use a Chromium-based browser (Chrome, Edge, Brave, Chromium) over localhost or HTTPS.');
    }
    const filters = ALL_PRODUCT_IDS.map((productId) => ({ vendorId: VENDOR_ID, productId }));
    const devices = await navigator.hid.requestDevice({ filters });
    if (!devices.length) return false;
    await this.open(devices[0]);
    return true;
  }

  async reconnectAuthorized() {
    if (!('hid' in navigator)) return false;
    const devices = (await navigator.hid.getDevices()).filter((d) => d.vendorId === VENDOR_ID && ALL_PRODUCT_IDS.includes(d.productId));
    if (!devices.length) return false;
    await this.open(devices[0]);
    return true;
  }

  async open(device) {
    if (this.device?.opened) await this.close();
    this._connectionGeneration += 1;
    this.device = device;
    if (!device.opened) await device.open();
    device.addEventListener('inputreport', this._inputHandler);
    this._log('system', null, `Opened VID ${device.vendorId.toString(16).padStart(4, '0')} PID ${device.productId.toString(16).padStart(4, '0')}`);
    this.dispatchEvent(new CustomEvent('connected', { detail: device }));
  }

  async close() {
    if (!this.device) return;
    this._connectionGeneration += 1;
    for (const waiter of [...this.waiters]) waiter.reject(new Error('HID device disconnected.'));
    this.device.removeEventListener('inputreport', this._inputHandler);
    if (this.device.opened) await this.device.close();
    this._log('system', null, 'Closed HID device');
    this.device = null;
    this.dispatchEvent(new Event('disconnected'));
  }

  _log(direction, body, note = '') {
    const item = { time: new Date(), direction, body: body ? Uint8Array.from(body) : null, note };
    this.log.push(item);
    if (this.log.length > this.maxLog) this.log.shift();
    this.dispatchEvent(new CustomEvent('log', { detail: item }));
  }

  _onInputReport(event) {
    if (event.reportId !== REPORT_ID) return;
    const body = new Uint8Array(event.data.buffer, event.data.byteOffset, event.data.byteLength);
    const copy = Uint8Array.from(body);
    this._log('in', copy, packetChecksumValid(copy) ? '' : 'checksum?');
    const pending = packetChecksumValid(copy) ? [...this.waiters] : [];
    for (const waiter of pending) {
      let matched = false;
      try { matched = waiter.predicate(copy); } catch { matched = false; }
      if (matched) {
        this.waiters = this.waiters.filter((w) => w !== waiter);
        waiter.resolve(copy);
      }
    }
    this.dispatchEvent(new CustomEvent('packet', { detail: copy }));
  }

  async send(body, note = '') {
    const generation = this._connectionGeneration;
    return this._serializeExchange(() => {
      if (generation !== this._connectionGeneration) throw new Error('HID connection changed before send.');
      return this._sendNow(body, note);
    });
  }

  async _sendNow(body, note = '') {
    if (!this.connected) throw new Error('No mouse connected.');
    const packet = Uint8Array.from(body);
    if (packet.length !== BODY_SIZE) throw new Error(`Expected ${BODY_SIZE}-byte HID body.`);
    this._log('out', packet, note);
    await this.device.sendReport(REPORT_ID, packet);
  }

  waitFor(predicate, timeoutMs = 900) {
    let waiter;
    let timer;
    const promise = new Promise((resolve, reject) => {
      waiter = { predicate, resolve, reject };
      this.waiters.push(waiter);
      timer = setTimeout(() => reject(new Error('HID request timed out')), timeoutMs);
    });
    const result = promise.finally(() => {
      clearTimeout(timer);
      this.waiters = this.waiters.filter((w) => w !== waiter);
    });
    result.cancel = (error) => waiter.reject(error);
    return result;
  }

  _serializeExchange(task) {
    const run = this._exchangeTail.then(task, task);
    // Keep the queue usable after a failed/timed-out command.
    this._exchangeTail = run.catch(() => {});
    return run;
  }

  async exchange(body, predicate, timeoutMs = 900, note = '') {
    const generation = this._connectionGeneration;
    return this._serializeExchange(async () => {
      if (generation !== this._connectionGeneration) throw new Error('HID connection changed before exchange.');
      // Start the timeout only when this transaction reaches the head of the
      // queue; otherwise queued commands could expire before they are sent.
      const response = this.waitFor(predicate, timeoutMs);
      // Attach rejection handling before sendReport: it can outlive the timeout.
      response.catch(() => {});
      try { await this._sendNow(body, note); }
      catch (error) {
        response.cancel?.(error);
        throw error;
      }
      return response;
    });
  }

  async command(opcode, payload = [], { timeoutMs = 900, marker = null, responseOpcode = opcode } = {}) {
    const body = rawCommandBody(opcode, payload, { marker });
    return this.exchange(body, (r) => r[0] === responseOpcode, timeoutMs, `opcode 0x${opcode.toString(16)}`);
  }

  async setDriverActive(active = true) {
    const body = rawCommandBody(OPCODE.PC_DRIVER_STATUS, [active ? 1 : 0]);
    await this.send(body, active ? 'driver online' : 'driver offline');
  }

  async handshake(challenge = null) {
    const nonce = challenge ?? crypto.getRandomValues(new Uint8Array(4));
    const payload = Uint8Array.of(...nonce.slice(0, 4), 0, 0, 0, 0);
    const response = await this.command(OPCODE.HANDSHAKE, payload);
    return {
      raw: response,
      cid: response[9],
      mid: response[10],
      deviceType: response[11],
    };
  }

  async getOnline() {
    const response = await this.command(OPCODE.ONLINE);
    return { online: Boolean(response[5]), usbAddress: [...response.slice(6, 9)] };
  }

  async getBattery() {
    const response = await this.command(OPCODE.BATTERY);
    const rawPercent = response[5];
    const charging = Boolean(response[6]);
    const millivolts = (response[7] << 8) | response[8];
    return {
      // The desktop app does not display the raw firmware percentage. It uses
      // the model's BatteryParam voltage curve through HIDUsb.dll's optimizer.
      percent: calibratedBatteryPercent(millivolts, charging) ?? rawPercent,
      rawPercent,
      charging,
      millivolts,
      raw: response,
    };
  }

  async getVersion(opcode = OPCODE.READ_VERSION) {
    const response = await this.command(opcode);
    return { opcode, major: response[5], minor: response[6], raw: response };
  }

  async getCurrentProfile() {
    const response = await this.command(OPCODE.GET_CURRENT_PROFILE);
    return response[5];
  }

  async setCurrentProfile(profile) {
    const body = rawCommandBody(OPCODE.SET_CURRENT_PROFILE, [u8(profile)]);
    await this.send(body, `set profile ${profile}`);
  }

  async getLongRangeMode() {
    const response = await this.command(OPCODE.GET_LONG_RANGE);
    return Boolean(response[5]);
  }

  async setLongRangeMode(enabled) {
    const body = rawCommandBody(OPCODE.SET_LONG_RANGE, [enabled ? 1 : 0]);
    await this.send(body, `long range ${enabled ? 'on' : 'off'}`);
  }

  async enterPairing() {
    const body = rawCommandBody(OPCODE.ENTER_PAIR);
    await this.send(body, 'enter pairing');
  }

  async getPairState() {
    const response = await this.command(OPCODE.PAIR_STATE);
    return { status: response[5], seconds: response[6], raw: response };
  }

  async clearSettings() {
    const body = rawCommandBody(OPCODE.CLEAR_SETTING);
    await this.send(body, 'factory reset');
  }

  async readFlash(address, length, { onProgress = () => {} } = {}) {
    validateFlashRange(address, length);
    const generation = this._connectionGeneration;
    const result = new Uint8Array(length);
    let offset = 0;
    while (offset < length) {
      if (generation !== this._connectionGeneration) throw new Error('HID connection changed during flash read.');
      const chunkLength = Math.min(10, length - offset);
      const addr = address + offset;
      const request = packetBody(OPCODE.READ_FLASH, { address: addr, length: chunkLength });
      const response = await this.exchange(
        request,
        (r) => r[0] === OPCODE.READ_FLASH && ((r[2] << 8) | r[3]) === addr && (r[4] & 0x7f) === chunkLength,
        1200,
        `read 0x${addr.toString(16)} +${chunkLength}`,
      );
      result.set(response.slice(5, 5 + chunkLength), offset);
      offset += chunkLength;
      onProgress(offset, length);
    }
    if (generation !== this._connectionGeneration) throw new Error('HID connection changed during flash read.');
    return result;
  }

  async writeFlash(address, data, { verify = true, pacingMs = 8 } = {}) {
    const bytes = validateBytes(data);
    validateFlashRange(address, bytes.length);
    const generation = this._connectionGeneration;
    let offset = 0;
    while (offset < bytes.length) {
      if (generation !== this._connectionGeneration) throw new Error('HID connection changed during flash write.');
      const chunk = bytes.slice(offset, offset + 10);
      const addr = address + offset;
      const request = packetBody(OPCODE.WRITE_FLASH, { address: addr, length: chunk.length, payload: chunk });
      await this.send(request, `write 0x${addr.toString(16)} +${chunk.length}`);
      if (pacingMs) await new Promise((resolve) => setTimeout(resolve, pacingMs));
      offset += chunk.length;
    }
    if (generation !== this._connectionGeneration) throw new Error('HID connection changed during flash write.');
    if (verify) {
      const check = await this.readFlash(address, bytes.length);
      if (!bytes.every((value, i) => check[i] === value)) {
        throw new Error(`Read-back verification failed at 0x${address.toString(16)}.`);
      }
    }
  }

  async getRssi() {
    const response = await this.command(OPCODE.GET_RSSI);
    return response[5];
  }

  async getReceiverIndicator() {
    const response = await this.command(OPCODE.GET_RECEIVER_INDICATOR);
    return { mode: response[5], arg1: response[6], arg2: response[7], raw: response };
  }

  async setReceiverIndicator(mode, arg1 = 0, arg2 = 0) {
    const request = rawCommandBody(OPCODE.SET_RECEIVER_INDICATOR, [mode, arg1, arg2], { marker: 0x0a });
    await this.send(request, 'set receiver indicator');
  }

  async getReceiverRgb() {
    const response = await this.command(OPCODE.GET_RECEIVER_RGB);
    return Uint8Array.from(response.slice(5, 12));
  }

  async setReceiverRgb(payload) {
    const request = rawCommandBody(OPCODE.SET_RECEIVER_RGB, Uint8Array.from(payload).slice(0, 7), { marker: 0x0a });
    await this.send(request, 'set receiver RGB');
  }

  exportLog() {
    return this.log.map((x) => `${x.time.toISOString()} ${x.direction.padEnd(6)} ${x.body ? hex(x.body) : ''} ${x.note}`.trim()).join('\n');
  }
}
