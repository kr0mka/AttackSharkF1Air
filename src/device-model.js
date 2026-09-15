import {
  ADDRESS,
  BASE_SETTINGS_SIZE,
  BUTTON_ACTIONS,
  BUTTON_COUNT,
  DEVICE_TYPE,
  DPI_STAGE_COUNT,
  F1_AIR_PROFILE,
  MACRO_SLOT_COUNT,
  MACRO_SLOT_SIZE,
  MOUSE_BUTTON_NAMES,
  OPCODE,
  POLLING_RATE_TO_RAW,
  RAW_TO_POLLING_RATE,
  SHORTCUT_SLOT_COUNT,
  SHORTCUT_SLOT_SIZE,
} from './constants.js';
import {
  decodeButtonAction,
  decodeDpiColor,
  decodeHighResDpi,
  decodeLegacyDpi,
  decodeLightBar,
  decodeMacro,
  decodeParityPair,
  decodeShortcut,
  encodeButtonAction,
  encodeDpiColor,
  encodeHighResDpi,
  encodeLegacyDpi,
  encodeLightBar,
  encodeMacro,
  encodeShortcut,
  fromBase64,
  hex,
  parityPair,
  toBase64,
} from './codecs.js';

const pair = (base, address, fallback = null) => decodeParityPair(base.slice(address, address + 2), fallback);

function blockValid(bytes) {
  if (!bytes?.length) return false;
  return ([...bytes].reduce((a, b) => (a + b) & 0xff, 0) & 0xff) === 0x55;
}

function parseAdvanced(base) {
  const pairAddresses = [0xbd, 0xbf, 0xc1, 0xd7, 0xd9, 0xdf, 0xe1, 0xe3, 0xe5, 0xe7];
  const pairs = Object.fromEntries(pairAddresses.map((addr) => [`0x${addr.toString(16)}`, pair(base, addr)]));
  const blocks = {};
  for (const addr of [0xc3, 0xc8, 0xcd, 0xd2]) {
    const raw = base.slice(addr, addr + 5);
    blocks[`0x${addr.toString(16)}`] = {
      valid: blockValid(raw),
      bytes: [...raw],
      valueLE: raw[0] | (raw[1] << 8) | (raw[2] << 16) | (raw[3] << 24),
    };
  }
  const db = base.slice(0xdb, 0xdf);
  return { pairs, blocks, db: { valid: blockValid(db), bytes: [...db] } };
}

export class MouseModel extends EventTarget {
  constructor(transport) {
    super();
    this.hid = transport;
    this.identity = null;
    this.base = null;
    this.settings = null;
    this.highResDpi = [];
    this.macros = new Map();
    this.shortcuts = new Map();
    this.lastBackup = null;
  }

  emit(type = 'change', detail = null) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }

  get isVerifiedF1Air() {
    return Boolean(
      this.identity &&
      this.identity.cid === F1_AIR_PROFILE.cid &&
      F1_AIR_PROFILE.supportedMids.includes(this.identity.mid),
    );
  }

  async initialize() {
    await this.hid.setDriverActive(true);
    const handshake = await this.hid.handshake();
    const [online, battery, mouseVersion, dongleVersion, profile, longRange] = await Promise.allSettled([
      this.hid.getOnline(),
      this.hid.getBattery(),
      this.hid.getVersion(OPCODE.READ_VERSION),
      this.hid.getVersion(OPCODE.GET_DONGLE_VERSION),
      this.hid.getCurrentProfile(),
      this.hid.getLongRangeMode(),
    ]);
    this.identity = {
      ...handshake,
      productId: this.hid.device?.productId ?? null,
      productName: this.hid.device?.productName ?? 'Attack Shark mouse',
      deviceTypeName: DEVICE_TYPE[handshake.deviceType] ?? `Type ${handshake.deviceType}`,
      online: online.status === 'fulfilled' ? online.value : null,
      battery: battery.status === 'fulfilled' ? battery.value : null,
      mouseVersion: mouseVersion.status === 'fulfilled' ? mouseVersion.value : null,
      dongleVersion: dongleVersion.status === 'fulfilled' ? dongleVersion.value : null,
      profile: profile.status === 'fulfilled' ? profile.value : null,
      longRange: longRange.status === 'fulfilled' ? longRange.value : null,
    };
    await this.refreshSettings();
    this.emit('ready', this.identity);
    return this.identity;
  }

  async refreshIdentity() {
    if (!this.identity) return this.initialize();
    const [battery, profile, longRange] = await Promise.allSettled([
      this.hid.getBattery(), this.hid.getCurrentProfile(), this.hid.getLongRangeMode(),
    ]);
    if (battery.status === 'fulfilled') this.identity.battery = battery.value;
    if (profile.status === 'fulfilled') this.identity.profile = profile.value;
    if (longRange.status === 'fulfilled') this.identity.longRange = longRange.value;
    try { this.identity.rssi = await this.hid.getRssi(); } catch { this.identity.rssi = null; }
    this.emit();
    return this.identity;
  }

  parseBase(base) {
    const stageCount = Math.max(1, Math.min(DPI_STAGE_COUNT, pair(base, ADDRESS.STAGE_COUNT, 1) ?? 1));
    const currentStage = Math.max(0, Math.min(stageCount - 1, pair(base, ADDRESS.CURRENT_DPI, 0) ?? 0));
    const dpiLegacy = [];
    const dpiColors = [];
    for (let i = 0; i < DPI_STAGE_COUNT; i += 1) {
      dpiLegacy.push(decodeLegacyDpi(base.slice(ADDRESS.DPI_VALUES + i * 4, ADDRESS.DPI_VALUES + i * 4 + 4)));
      dpiColors.push(decodeDpiColor(base.slice(ADDRESS.DPI_COLORS + i * 4, ADDRESS.DPI_COLORS + i * 4 + 4)));
    }
    const buttons = [];
    for (let i = 0; i < BUTTON_COUNT; i += 1) {
      const raw = base.slice(ADDRESS.BUTTONS + i * 4, ADDRESS.BUTTONS + i * 4 + 4);
      const parsed = decodeButtonAction(raw);
      buttons.push({ index: i, name: MOUSE_BUTTON_NAMES[i], raw: [...raw], ...parsed });
    }
    return {
      reportRateRaw: pair(base, ADDRESS.REPORT_RATE),
      reportRateHz: RAW_TO_POLLING_RATE.get(pair(base, ADDRESS.REPORT_RATE)) ?? null,
      stageCount,
      currentStage,
      sensorStaticScan: pair(base, ADDRESS.SENSOR_STATIC_SCAN),
      lodRaw: pair(base, ADDRESS.LOD),
      dpiLegacy,
      dpiColors,
      dpiEffect: {
        mode: pair(base, ADDRESS.DPI_EFFECT_MODE),
        brightness: pair(base, ADDRESS.DPI_EFFECT_BRIGHTNESS),
        speed: pair(base, ADDRESS.DPI_EFFECT_SPEED),
        state: pair(base, ADDRESS.DPI_EFFECT_STATE),
      },
      buttons,
      lightBar: decodeLightBar(base.slice(ADDRESS.LIGHT_BAR, ADDRESS.LIGHT_BAR + 9)),
      debounce: pair(base, ADDRESS.DEBOUNCE),
      motionSync: pair(base, ADDRESS.MOTION_SYNC),
      sleepTime: pair(base, ADDRESS.SLEEP_TIME),
      angleSnapping: pair(base, ADDRESS.ANGLE_SNAPPING),
      ripple: pair(base, ADDRESS.RIPPLE),
      movingLightOff: pair(base, ADDRESS.MOVING_LIGHT_OFF),
      performanceState: pair(base, ADDRESS.PERFORMANCE_STATE),
      performanceTime: pair(base, ADDRESS.PERFORMANCE_TIME),
      sensorMode: pair(base, ADDRESS.SENSOR_MODE),
      advanced: parseAdvanced(base),
    };
  }

  async refreshSettings() {
    this.base = await this.hid.readFlash(0, BASE_SETTINGS_SIZE);
    this.settings = this.parseBase(this.base);
    this.highResDpi = [];
    for (let i = 0; i < DPI_STAGE_COUNT; i += 1) {
      try {
        const raw = await this.hid.readFlash(ADDRESS.HIGH_RES_DPI + i * 6, 6);
        this.highResDpi.push({ raw: [...raw], parsed: decodeHighResDpi(raw) });
      } catch {
        this.highResDpi.push({ raw: [], parsed: null });
      }
    }
    this.settings.dpi = Array.from({ length: DPI_STAGE_COUNT }, (_, i) =>
      this.highResDpi[i]?.parsed?.dpi ?? this.settings.dpiLegacy[i] ?? 800,
    );
    this.emit();
    return this.settings;
  }

  async writePair(address, value) {
    await this.hid.writeFlash(address, parityPair(value));
    await this.refreshSettings();
  }

  async setPollingRate(hz) {
    const raw = POLLING_RATE_TO_RAW.get(Number(hz));
    if (raw == null) throw new Error(`Unsupported polling rate: ${hz}`);
    await this.writePair(ADDRESS.REPORT_RATE, raw);
  }

  async setStageCount(count) {
    const value = Math.max(1, Math.min(DPI_STAGE_COUNT, Number(count)));
    await this.writePair(ADDRESS.STAGE_COUNT, value);
  }

  async setCurrentDpiStage(index) {
    await this.writePair(ADDRESS.CURRENT_DPI, Math.max(0, Math.min(DPI_STAGE_COUNT - 1, Number(index))));
  }

  async setDpi(index, dpi) {
    const i = Number(index);
    if (i < 0 || i >= DPI_STAGE_COUNT) throw new Error('DPI stage out of range.');
    const value = Math.max(F1_AIR_PROFILE.dpi.min, Math.min(F1_AIR_PROFILE.dpi.max, Math.round(Number(dpi))));
    // The PAW3955 profile carries an exact 16-bit X/Y table at 0x1B00.
    await this.hid.writeFlash(ADDRESS.HIGH_RES_DPI + i * 6, encodeHighResDpi(value));
    // Keep the legacy table coherent for firmware/UI paths which still consult it.
    await this.hid.writeFlash(ADDRESS.DPI_VALUES + i * 4, encodeLegacyDpi(value));
    await this.refreshSettings();
  }

  async setDpiColor(index, color) {
    const i = Number(index);
    await this.hid.writeFlash(ADDRESS.DPI_COLORS + i * 4, encodeDpiColor(color));
    await this.refreshSettings();
  }

  async setDpiEffect({ mode, brightness, speed, state }) {
    for (const [addr, value] of [
      [ADDRESS.DPI_EFFECT_MODE, mode], [ADDRESS.DPI_EFFECT_BRIGHTNESS, brightness],
      [ADDRESS.DPI_EFFECT_SPEED, speed], [ADDRESS.DPI_EFFECT_STATE, state],
    ]) {
      if (value != null) await this.hid.writeFlash(addr, parityPair(value));
    }
    await this.refreshSettings();
  }

  async setButton(index, type, param = 0) {
    const i = Number(index);
    if (i < 0 || i >= BUTTON_COUNT) throw new Error('Button index out of range.');
    await this.hid.writeFlash(ADDRESS.BUTTONS + i * 4, encodeButtonAction(type, param));
    await this.refreshSettings();
  }

  async setButtonPreset(index, key) {
    const action = BUTTON_ACTIONS.find((x) => x.key === key);
    if (!action) throw new Error(`Unknown button preset: ${key}`);
    return this.setButton(index, action.type, action.param);
  }

  async setLightBar(value) {
    await this.hid.writeFlash(ADDRESS.LIGHT_BAR, encodeLightBar(value));
    await this.refreshSettings();
  }

  async setMacroSlot(slot, macro) {
    const i = Number(slot);
    if (i < 0 || i >= MACRO_SLOT_COUNT) throw new Error('Macro slot out of range.');
    const raw = encodeMacro(macro);
    await this.hid.writeFlash(ADDRESS.MACROS + i * MACRO_SLOT_SIZE, raw);
    this.macros.set(i, { raw, parsed: decodeMacro(raw) });
    this.emit();
  }

  async getMacroSlot(slot, force = false) {
    const i = Number(slot);
    if (!force && this.macros.has(i)) return this.macros.get(i);
    const raw = await this.hid.readFlash(ADDRESS.MACROS + i * MACRO_SLOT_SIZE, MACRO_SLOT_SIZE);
    const result = { raw, parsed: decodeMacro(raw) };
    this.macros.set(i, result);
    return result;
  }

  async setShortcutSlot(slot, events) {
    const i = Number(slot);
    if (i < 0 || i >= SHORTCUT_SLOT_COUNT) throw new Error('Shortcut slot out of range.');
    const raw = encodeShortcut(events);
    await this.hid.writeFlash(ADDRESS.SHORTCUTS + i * SHORTCUT_SLOT_SIZE, raw);
    this.shortcuts.set(i, { raw, parsed: decodeShortcut(raw) });
    this.emit();
  }

  async getShortcutSlot(slot, force = false) {
    const i = Number(slot);
    if (!force && this.shortcuts.has(i)) return this.shortcuts.get(i);
    const raw = await this.hid.readFlash(ADDRESS.SHORTCUTS + i * SHORTCUT_SLOT_SIZE, SHORTCUT_SLOT_SIZE);
    const result = { raw, parsed: decodeShortcut(raw) };
    this.shortcuts.set(i, result);
    return result;
  }

  async setProfile(profile) {
    await this.hid.setCurrentProfile(Math.max(0, Math.min(3, Number(profile))));
    this.identity.profile = Number(profile);
    await new Promise((r) => setTimeout(r, 80));
    await this.refreshSettings();
  }

  async setLongRange(enabled) {
    await this.hid.setLongRangeMode(Boolean(enabled));
    this.identity.longRange = Boolean(enabled);
    this.emit();
  }

  async pairReceiver() {
    await this.hid.enterPairing();
    return this.hid.getPairState();
  }

  async restoreFactory() {
    await this.hid.clearSettings();
    await new Promise((r) => setTimeout(r, 500));
    await this.refreshSettings();
  }

  async getReceiverIndicator() {
    return this.hid.getReceiverIndicator();
  }

  async setReceiverIndicator(mode, arg1 = 0, arg2 = 0) {
    await this.hid.setReceiverIndicator(mode, arg1, arg2);
    return this.getReceiverIndicator();
  }

  async createBackup({ includeMacros = true, includeShortcuts = true } = {}) {
    const base = await this.hid.readFlash(0, BASE_SETTINGS_SIZE);
    const highRes = await this.hid.readFlash(ADDRESS.HIGH_RES_DPI, DPI_STAGE_COUNT * 6);
    const payload = {
      schema: 'attackshark-f1-airi-backup/v1',
      createdAt: new Date().toISOString(),
      identity: {
        vendorId: this.hid.device?.vendorId,
        productId: this.hid.device?.productId,
        cid: this.identity?.cid,
        mid: this.identity?.mid,
      },
      activeProfile: this.identity?.profile,
      regions: {
        base: { address: 0, data: toBase64(base) },
        highResDpi: { address: ADDRESS.HIGH_RES_DPI, data: toBase64(highRes) },
      },
    };
    if (includeShortcuts) {
      const raw = await this.hid.readFlash(ADDRESS.SHORTCUTS, SHORTCUT_SLOT_COUNT * SHORTCUT_SLOT_SIZE);
      payload.regions.shortcuts = { address: ADDRESS.SHORTCUTS, data: toBase64(raw) };
    }
    if (includeMacros) {
      const raw = await this.hid.readFlash(ADDRESS.MACROS, MACRO_SLOT_COUNT * MACRO_SLOT_SIZE);
      payload.regions.macros = { address: ADDRESS.MACROS, data: toBase64(raw) };
    }
    this.lastBackup = payload;
    return payload;
  }

  validateBackup(backup) {
    if (backup?.schema !== 'attackshark-f1-airi-backup/v1') throw new Error('Unsupported backup schema.');
    if (backup.identity?.cid != null && this.identity?.cid != null && backup.identity.cid !== this.identity.cid) {
      throw new Error(`Backup CID ${backup.identity.cid} does not match connected CID ${this.identity.cid}.`);
    }
    if (!backup.regions?.base || !backup.regions?.highResDpi) throw new Error('Backup is missing required regions.');
  }

  async restoreBackup(backup) {
    this.validateBackup(backup);
    const order = ['base', 'highResDpi', 'shortcuts', 'macros'];
    for (const name of order) {
      const region = backup.regions?.[name];
      if (!region) continue;
      await this.hid.writeFlash(Number(region.address), fromBase64(region.data));
    }
    await this.refreshSettings();
  }

  diagnostics() {
    return {
      identity: this.identity,
      verifiedF1Air: this.isVerifiedF1Air,
      baseHex: this.base ? hex(this.base) : null,
      settings: this.settings,
      highResDpi: this.highResDpi,
    };
  }
}
