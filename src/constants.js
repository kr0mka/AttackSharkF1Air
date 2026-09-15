export const APP_NAME = 'F1 AIR Open Control';
export const VENDOR_ID = 0x3554;

export const PRODUCT_IDS = {
  wired: [0xfb43, 0xf516, 0xf515],
  receiver8k: [0xfb44, 0xfb35, 0xf517],
};

export const ALL_PRODUCT_IDS = [...new Set([...PRODUCT_IDS.wired, ...PRODUCT_IDS.receiver8k])];
export const REPORT_ID = 0x08;
export const BODY_SIZE = 16;
export const CHECKSUM_TARGET = 0x55;
export const BODY_CHECKSUM_TARGET = (CHECKSUM_TARGET - REPORT_ID) & 0xff;

export const OPCODE = Object.freeze({
  HANDSHAKE: 0x01,
  PC_DRIVER_STATUS: 0x02,
  ONLINE: 0x03,
  BATTERY: 0x04,
  ENTER_PAIR: 0x05,
  PAIR_STATE: 0x06,
  WRITE_FLASH: 0x07,
  READ_FLASH: 0x08,
  CLEAR_SETTING: 0x09,
  STATUS_CHANGED: 0x0a,
  GET_CURRENT_PROFILE: 0x0e,
  SET_CURRENT_PROFILE: 0x0f,
  READ_VERSION: 0x12,
  SET_LONG_RANGE: 0x16,
  GET_LONG_RANGE: 0x17,
  GET_DONGLE_VERSION: 0x1d,
  GET_RSSI: 0x2b,
  SET_RECEIVER_INDICATOR: 0x2c,
  GET_RECEIVER_INDICATOR: 0x2d,
  SET_RECEIVER_RGB: 0x18,
  GET_RECEIVER_RGB: 0x19,
});

export const ADDRESS = Object.freeze({
  REPORT_RATE: 0x0000,
  STAGE_COUNT: 0x0002,
  CURRENT_DPI: 0x0004,
  SENSOR_STATIC_SCAN: 0x0008,
  LOD: 0x000a,
  DPI_VALUES: 0x000c,
  DPI_COLORS: 0x002c,
  DPI_EFFECT_MODE: 0x004c,
  DPI_EFFECT_BRIGHTNESS: 0x004e,
  DPI_EFFECT_SPEED: 0x0050,
  DPI_EFFECT_STATE: 0x0052,
  BUTTONS: 0x0060,
  LIGHT_BAR: 0x00a0,
  DEBOUNCE: 0x00a9,
  MOTION_SYNC: 0x00ab,
  SLEEP_TIME: 0x00ad,
  ANGLE_SNAPPING: 0x00af,
  RIPPLE: 0x00b1,
  MOVING_LIGHT_OFF: 0x00b3,
  PERFORMANCE_STATE: 0x00b5,
  PERFORMANCE_TIME: 0x00b7,
  SENSOR_MODE: 0x00b9,
  ADVANCED_BD: 0x00bd,
  ADVANCED_BF: 0x00bf,
  ADVANCED_C1: 0x00c1,
  DYNAMIC_CURVE_0: 0x00c3,
  DYNAMIC_CURVE_1: 0x00c8,
  DYNAMIC_CURVE_2: 0x00cd,
  DYNAMIC_CURVE_3: 0x00d2,
  ADVANCED_D7: 0x00d7,
  ADVANCED_D9: 0x00d9,
  ADVANCED_DB: 0x00db,
  ADVANCED_DF: 0x00df,
  ADVANCED_E1: 0x00e1,
  ADVANCED_E3: 0x00e3,
  ADVANCED_E5: 0x00e5,
  ADVANCED_E7: 0x00e7,
  SHORTCUTS: 0x0100,
  MACROS: 0x0300,
  HIGH_RES_DPI: 0x1b00,
});

export const BASE_SETTINGS_SIZE = 0x00e8;
export const DPI_STAGE_COUNT = 8;
export const BUTTON_COUNT = 6;
export const SHORTCUT_SLOT_COUNT = 16;
export const SHORTCUT_SLOT_SIZE = 32;
export const MACRO_SLOT_COUNT = 16;
export const MACRO_SLOT_SIZE = 384;

export const POLLING_RATE_TO_RAW = new Map([
  [125, 0x08],
  [250, 0x04],
  [500, 0x02],
  [1000, 0x01],
  [2000, 0x10],
  [4000, 0x20],
  [8000, 0x40],
]);
export const RAW_TO_POLLING_RATE = new Map([...POLLING_RATE_TO_RAW].map(([hz, raw]) => [raw, hz]));

export const DEVICE_TYPE = Object.freeze({
  0: 'Wireless 1K',
  1: 'Wireless 4K',
  2: 'Wired 1K',
  3: 'Wired 8K',
  4: 'Wireless 2K',
  5: 'Wireless 8K',
});

export const SENSOR_MODES = Object.freeze({
  0: 'LP',
  1: 'HP',
  256: 'Corded / auto high-rate',
});

export const F1_AIR_PROFILE = Object.freeze({
  name: 'Attack Shark F1 AIR',
  vendorId: VENDOR_ID,
  cid: 124,
  supportedMids: [19, 20, 21, 22],
  sensor: 'PAW3955',
  dpi: { min: 1, max: 60000, step: 1, highResFlag: 0x11 },
  lodMm: [0.7, 0.9, 1.2, 1.4, 1.6],
  supports: {
    sensorMode: true,
    lod: true,
    ripple: true,
    angleSnapping: true,
    motionSync: true,
    mousepadCalibration: false,
  },
});

export const SLEEP_CODES = Object.freeze([
  { raw: 1, label: '10 seconds' },
  { raw: 3, label: '30 seconds' },
  { raw: 6, label: '1 minute' },
  { raw: 12, label: '2 minutes' },
  { raw: 18, label: '3 minutes' },
  { raw: 30, label: '5 minutes' },
  { raw: 60, label: '10 minutes' },
  { raw: 90, label: '15 minutes' },
]);

export const DPI_LIGHT_MODES = Object.freeze([
  { raw: 0, label: 'Off' },
  { raw: 1, label: 'Steady' },
  { raw: 2, label: 'Breathing' },
]);

export const DECORATIVE_LIGHT_MODES = Object.freeze([
  { raw: 0, label: 'Off' },
  { raw: 1, label: 'Rainbow' },
  { raw: 2, label: 'Single-color breathing' },
  { raw: 3, label: 'Fixed color' },
  { raw: 4, label: 'Neon' },
  { raw: 5, label: 'Rainbow breathing' },
  { raw: 6, label: 'Fixed rainbow' },
]);

export const RECEIVER_INDICATOR_MODES = Object.freeze([
  { raw: 0, label: 'Always off' },
  { raw: 1, label: 'Polling rate' },
  { raw: 2, label: 'Mouse battery' },
  { raw: 3, label: 'Connection quality' },
  { raw: 4, label: 'DPI level' },
]);

export const BUTTON_ACTIONS = Object.freeze([
  { key: 'disabled', label: 'Disabled', type: 0x00, param: 0x0000 },
  { key: 'left', label: 'Left button', type: 0x01, param: 0x0100 },
  { key: 'right', label: 'Right button', type: 0x01, param: 0x0200 },
  { key: 'middle', label: 'Middle / wheel click', type: 0x01, param: 0x0400 },
  { key: 'back', label: 'Back', type: 0x01, param: 0x0800 },
  { key: 'forward', label: 'Forward', type: 0x01, param: 0x1000 },
  { key: 'dpi-cycle', label: 'DPI cycle', type: 0x02, param: 0x0100 },
  { key: 'dpi-up', label: 'DPI +', type: 0x02, param: 0x0200 },
  { key: 'dpi-down', label: 'DPI −', type: 0x02, param: 0x0300 },
  { key: 'hscroll-left', label: 'Horizontal scroll left', type: 0x03, param: 0x0100 },
  { key: 'hscroll-right', label: 'Horizontal scroll right', type: 0x03, param: 0x0200 },
  { key: 'polling-cycle', label: 'Polling-rate switch', type: 0x07, param: 0x0000 },
  { key: 'profile-cycle', label: 'Profile switch', type: 0x09, param: 0x0000 },
  { key: 'vscroll-up', label: 'Vertical scroll up', type: 0x0b, param: 0x0100 },
  { key: 'vscroll-down', label: 'Vertical scroll down', type: 0x0b, param: 0x0200 },
  { key: 'undefined', label: 'Undefined button', type: 0x10, param: 0x0000 },
  { key: 'light-switch', label: 'Switch decorative lamp', type: 0x11, param: 0x0000 },
  { key: 'dpi-lock', label: 'DPI lock', type: 0x12, param: 0x0000 },
  { key: 'lights-all', label: 'On/off all decorative lights', type: 0x13, param: 0x0000 },
  { key: 'dpi-indicator', label: 'On/off DPI indicator', type: 0x14, param: 0x0000 },
  { key: 'light-strip', label: 'On/off light strip', type: 0x15, param: 0x0000 },
  { key: 'light-strip-cycle', label: 'Cycle light-strip effect', type: 0x16, param: 0x0000 },
]);

export const MOUSE_BUTTON_NAMES = ['Left', 'Right', 'Middle', 'Back', 'Forward', 'DPI / Top'];

export const CONSUMER_KEYS = Object.freeze([
  { usage: 0x00cd, label: 'Play / Pause' },
  { usage: 0x00b5, label: 'Next track' },
  { usage: 0x00b6, label: 'Previous track' },
  { usage: 0x00b7, label: 'Stop' },
  { usage: 0x00e2, label: 'Mute' },
  { usage: 0x00e9, label: 'Volume +' },
  { usage: 0x00ea, label: 'Volume −' },
  { usage: 0x0183, label: 'Media player' },
]);

export const MACRO_MOUSE_EVENTS = Object.freeze([
  { code: 0x04, data1: 0x00, data2: 0x01, label: 'Left click' },
  { code: 0x04, data1: 0x00, data2: 0x02, label: 'Right click' },
  { code: 0x04, data1: 0x00, data2: 0x04, label: 'Middle click' },
  { code: 0x04, data1: 0x00, data2: 0x10, label: 'Forward click' },
  { code: 0x04, data1: 0x00, data2: 0x08, label: 'Back click' },
]);
