import {
  ADDRESS,
  APP_NAME,
  BUTTON_ACTIONS,
  CONSUMER_KEYS,
  DECORATIVE_LIGHT_MODES,
  DPI_LIGHT_MODES,
  MACRO_MOUSE_EVENTS,
  POLLING_RATE_TO_RAW,
  RECEIVER_INDICATOR_MODES,
  SENSOR_MODES,
  SLEEP_CODES,
} from './constants.js';
import { hex, parseHex } from './codecs.js';
import { CompXDevice } from './protocol.js';
import { MouseModel } from './device-model.js';
import { createCaptureLabState, renderCaptureLab, bindCaptureLab } from './ui/capture-lab.js';
import { lodOptions as renderLodOptions, physicalButtons } from './ui/f1-controls.js';
import { captureEndpoints } from './protocol/endpoints.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const content = $('#content');
const connectBtn = $('#connect-btn');
const refreshBtn = $('#refresh-btn');
const connectionPill = $('#connection-pill');
const expertWrites = $('#expert-writes');
const backupFile = $('#backup-file');
const firmwareFile = $('#firmware-file');
const confirmDialog = $('#confirm-dialog');
const confirmTitle = $('#confirm-title');
const confirmCopy = $('#confirm-copy');

const hid = new CompXDevice();
const model = new MouseModel(hid);
const captureLab = createCaptureLabState();
const busyDisabled = new WeakMap();

const app = {
  tab: 'overview',
  busy: false,
  selectedMacroSlot: 0,
  macroDraft: { name: 'Macro 01', events: [] },
  macroLoaded: false,
  macroRecording: false,
  macroRecordStartedAt: 0,
  macroLastAt: 0,
  selectedShortcutSlot: 0,
  shortcutDraft: [],
  firmwareInspection: null,
  endpointCapture: null,
};

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

function attr(value) { return esc(value); }
function checked(value) { return value ? 'checked' : ''; }
function selected(value, expected) { return String(value) === String(expected) ? 'selected' : ''; }
function disabled(value = true) { return value ? 'disabled' : ''; }

function toast(message, kind = '') {
  const stack = $('#toast-stack');
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.textContent = message;
  stack.append(el);
  setTimeout(() => el.remove(), 4200);
}

function download(name, data, type = 'application/octet-stream') {
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

function fmtVersion(v) {
  if (!v) return '—';
  return `v${v.major}.${Number(v.minor).toString(16).padStart(2, '0').toUpperCase()}`;
}

function setConnectionUi() {
  const connected = hid.connected;
  connectionPill.className = `pill ${connected ? 'online' : 'offline'}`;
  connectionPill.innerHTML = `<i></i><span>${connected ? 'Connected' : 'Disconnected'}</span>`;
  connectBtn.textContent = connected ? 'Disconnect' : 'Connect mouse';
  refreshBtn.disabled = !connected || app.busy;
}

function setBusy(value) {
  app.busy = Boolean(value);
  connectBtn.disabled = app.busy;
  refreshBtn.disabled = app.busy || !hid.connected;
  $$('#content button, #content input, #content select, #content textarea, #nav button, #expert-writes').forEach((el) => {
    if (app.busy) {
      if (!busyDisabled.has(el)) busyDisabled.set(el, el.disabled);
      el.disabled = true;
    } else if (busyDisabled.has(el)) {
      el.disabled = busyDisabled.get(el);
      busyDisabled.delete(el);
    }
  });
}

function ensureWritable() {
  if (!hid.connected) throw new Error('Connect the mouse first.');
  if (model.isVerifiedF1Air) return;
  if (expertWrites.checked) return;
  const id = model.identity;
  throw new Error(`Writes are locked: connected CID/MID is ${id?.cid ?? '?'}/${id?.mid ?? '?'}, not the hardware-verified F1 AIR profile 124/20. Enable Expert writes only if you know this is compatible.`);
}

async function run(task, { write = false, success = null, rerender = true } = {}) {
  if (app.busy) return null;
  try {
    if (write) ensureWritable();
    setBusy(true);
    const result = await task();
    if (success) toast(success, 'success');
    if (rerender) render();
    return result;
  } catch (error) {
    console.error(error);
    toast(error?.message || String(error), 'error');
    if (rerender) render();
    return null;
  } finally {
    setBusy(false);
    setConnectionUi();
  }
}

function confirmAction(title, copy) {
  confirmTitle.textContent = title;
  confirmCopy.textContent = copy;
  confirmDialog.showModal();
  return new Promise((resolve) => {
    const handler = () => {
      confirmDialog.removeEventListener('close', handler);
      resolve(confirmDialog.returnValue === 'confirm');
    };
    confirmDialog.addEventListener('close', handler);
  });
}

function pageHead(kicker, title, copy, right = '') {
  return `<div class="page-head"><div><div class="eyebrow">${esc(kicker)}</div><h2>${esc(title)}</h2><p>${esc(copy)}</p></div>${right}</div>`;
}

function emptyState() {
  return `${pageHead('F1 AIR', 'Open Control', 'A local, auditable WebHID replacement for the vendor control panel.')}
    <div class="empty-state"><div><strong>Connect an Attack Shark F1 AIR</strong>Use the 2.4 GHz receiver or USB cable, then choose the device from the browser prompt.<br><br><button class="button primary" id="empty-connect">Connect mouse</button></div></div>`;
}

function renderOverview() {
  const id = model.identity;
  const s = model.settings;
  const battery = id.battery;
  const verified = model.isVerifiedF1Air;
  const profileButtons = [0,1,2,3].map((p) => `<button class="button tiny ${id.profile === p ? 'active' : ''}" data-profile="${p}" data-write>Profile ${p + 1}</button>`).join('');
  return `${pageHead('Device', 'Overview', 'Live device state, onboard profile, wireless link and power controls.', `<span class="tag ${verified ? 'accent' : 'warning'}">${verified ? 'Verified F1 AIR profile' : 'Unverified device profile'}</span>`)}
    <div class="grid four">
      <div class="card metric"><div class="metric-label">Battery</div><div class="metric-value">${battery ? `${esc(battery.percent)}<span class="unit">%</span>` : '—'}</div><div class="metric-sub">${battery ? `${battery.charging ? 'Charging · ' : ''}${battery.millivolts || '—'} mV` : 'No battery response'}</div></div>
      <div class="card metric"><div class="metric-label">Polling rate</div><div class="metric-value">${s?.reportRateHz ? `${s.reportRateHz}<span class="unit">Hz</span>` : '—'}</div><div class="metric-sub">Onboard report-rate byte ${s?.reportRateRaw ?? '—'}</div></div>
      <div class="card metric"><div class="metric-label">Current DPI</div><div class="metric-value">${s ? esc(s.dpi[s.currentStage]) : '—'}<span class="unit">DPI</span></div><div class="metric-sub">Stage ${s ? s.currentStage + 1 : '—'} of ${s?.stageCount ?? '—'}</div></div>
      <div class="card metric"><div class="metric-label">Link</div><div class="metric-value" style="font-size:20px">${esc(id.deviceTypeName)}</div><div class="metric-sub">RSSI ${id.rssi ?? '—'} · ${id.online?.online === false ? 'mouse asleep/offline' : 'online'}</div></div>
    </div>
    <div class="grid two" style="margin-top:14px">
      <div class="card">
        <div class="card-head"><div><h3>Device identity</h3><p>Returned by the CompX handshake; used to gate writes.</p></div><span class="tag blue">VID 0x${Number(id.productId != null ? hid.device.vendorId : 0).toString(16).toUpperCase()}</span></div>
        <div class="setting-list">
          <div class="setting-row"><div class="setting-copy"><b>Product</b><small>${esc(id.productName)}</small></div><div class="mono">PID 0x${Number(id.productId).toString(16).padStart(4,'0').toUpperCase()}</div></div>
          <div class="setting-row"><div class="setting-copy"><b>Protocol identity</b><small>Verified F1 AIR: CID 124 / MID 20; other package MIDs are candidates</small></div><div class="mono">CID ${id.cid} · MID ${id.mid}</div></div>
          <div class="setting-row"><div class="setting-copy"><b>Version endpoints</b><small>Mouse endpoint / receiver. The wireless 0xB3 value may differ from Control HUB firmware.</small></div><div>${fmtVersion(id.mouseVersion)} / ${fmtVersion(id.dongleVersion)}</div></div>
        </div>
      </div>
      <div class="card">
        <div class="card-head"><div><h3>Quick controls</h3><p>Profile, range mode and receiver pairing.</p></div></div>
        <div class="control"><label>Onboard profile</label><div class="button-row">${profileButtons}</div></div>
        <div class="setting-list" style="margin-top:12px">
          <div class="setting-row"><div class="setting-copy"><b>Long-distance mode</b><small>Higher wireless link margin at the cost of battery.</small></div><label class="switch"><input id="long-range" type="checkbox" ${checked(id.longRange)} data-write><span class="switch-track"></span><span class="switch-text">${id.longRange ? 'On' : 'Off'}</span></label></div>
          <div class="setting-row"><div class="setting-copy"><b>Pair a receiver</b><small>Hold left + right + middle for ~3 s first, then put the mouse near the receiver.</small></div><button class="button" id="pair-btn" data-write>Start pairing</button></div>
        </div>
      </div>
    </div>`;
}

function renderSensor() {
  const s = model.settings;
  const rateButtons = [...POLLING_RATE_TO_RAW.keys()].map((hz) => `<button class="button tiny ${s.reportRateHz === hz ? 'active' : ''}" data-rate="${hz}" data-write>${hz >= 1000 ? `${hz/1000}K` : hz} Hz</button>`).join('');
  const stages = Array.from({ length: s.stageCount }, (_, i) => {
    const value = s.dpi[i] ?? s.dpiLegacy[i] ?? 800;
    const color = s.dpiColors[i] || '#ffffff';
    return `<div class="dpi-stage ${i === s.currentStage ? 'current' : ''} ${i >= s.stageCount ? 'disabled-stage' : ''}">
      <div class="between"><span class="dpi-num">Stage ${i + 1}</span><button class="button tiny ${i === s.currentStage ? 'active' : ''}" data-stage="${i}" data-write>${i === s.currentStage ? 'Active' : 'Use'}</button></div>
      <div class="dpi-value">${esc(value)} <span class="unit">DPI</span></div>
      <div class="dpi-actions"><input data-dpi-input="${i}" type="number" min="1" max="60000" step="1" value="${esc(value)}"><input data-dpi-color="${i}" type="color" value="${attr(color)}" title="Stage color"></div>
      <div class="button-row" style="margin-top:7px"><button class="button tiny" data-save-dpi="${i}" data-write>Save DPI</button><button class="button tiny ghost" data-save-color="${i}" data-write>Save color</button></div>
    </div>`;
  }).join('');
  const lodOptions = renderLodOptions(s.lodRaw);
  const sensorModes = Object.entries(SENSOR_MODES).filter(([value]) => Number(value) < 256).map(([value,label]) => `<option value="${value}" ${selected(value,s.sensorMode)}>${esc(label)}</option>`).join('');
  const sleepOptions = SLEEP_CODES.map((x) => `<option value="${x.raw}" ${selected(x.raw,s.performanceTime)}>${x.label}</option>`).join('');
  const rotationRaw = s.sensorRotationRaw ?? (model.base?.[6] ?? 0);
  const rotation = rotationRaw;
  return `${pageHead('Performance', 'Sensor', 'DPI, report rate and PAW3955 onboard sensor features. Exact DPI uses the F1 AIR high-resolution table recovered from the bundled driver.')}
    <div class="card">
      <div class="card-head"><div><h3>DPI stages</h3><p>F1 AIR profile: 1–60,000 DPI in 1-DPI increments. The exact high-resolution table and legacy table are updated together.</p></div><div class="control" style="min-width:130px"><label>Enabled stages</label><select id="stage-count" data-write>${Array.from({length:8},(_,i)=>`<option value="${i+1}" ${selected(i+1,s.stageCount)}>${i+1}</option>`).join('')}</select></div></div>
      <div class="dpi-grid">${stages}</div>
    </div>
    <div class="grid two" style="margin-top:14px">
      <div class="card">
        <div class="card-head"><div><h3>Tracking</h3><p>Core sensor controls stored in the profile flash.</p></div></div>
        <div class="setting-list">
          <div class="setting-row"><div class="setting-copy"><b>Polling rate</b><small>125–8000 Hz; high rates increase CPU and battery use.</small></div><div class="button-row">${rateButtons}</div></div>
          <div class="setting-row"><div class="setting-copy"><b>Debounce</b><small>Lower values reduce click delay but can expose switch chatter.</small></div><div class="inline" style="gap:8px"><input id="debounce" type="range" min="0" max="15" value="${s.debounce ?? 1}" data-write><span class="mono" id="debounce-label">${s.debounce ?? 1} ms</span></div></div>
          <div class="setting-row"><div class="setting-copy"><b>Sensor mode</b><small>“Corded / auto high-rate” is entered automatically by firmware and is not a byte-stored selectable value.</small></div><select id="sensor-mode" data-write>${sensorModes}</select></div>
          <div class="setting-row"><div class="setting-copy"><b>Lift-off distance (LOD)</b><small>Verified F1 AIR levels: 0.7, 0.9, 1.2, 1.4 and 1.6 mm.</small></div><select id="lod-raw" data-write>${lodOptions}</select></div>
          <div class="setting-row"><div class="setting-copy"><b>Sensor rotation</b><small>Candidate raw byte at 0x0006. Angle units and signed encoding are unproven; Expert writes required.</small></div><div class="inline" style="gap:8px"><input id="sensor-rotation" type="number" min="0" max="255" value="${rotation}"><button class="button tiny" id="save-rotation" data-write>Save</button></div></div>
          <div class="setting-row"><div class="setting-copy"><b>20K FPS scanning</b><small>Candidate at 0x0008; On/Off semantics need capture verification. Expert writes required.</small></div><label class="switch"><input id="scan-20k" type="checkbox" ${checked(Boolean(s.sensorStaticScan))} data-write><span class="switch-track"></span><span class="switch-text">${s.sensorStaticScan ? 'On' : 'Off'}</span></label></div>
        </div>
      </div>
      <div class="card">
        <div class="card-head"><div><h3>Sensor processing</h3><p>Capabilities enabled for PAW3955 in the bundled <code>driver_sensor.h</code>.</p></div><span class="tag accent">PAW3955</span></div>
        <div class="setting-list">
          ${toggleRow('motion-sync','Motion sync','Synchronize sensor samples to USB reports.',s.motionSync)}
          ${toggleRow('angle-snap','Angle snapping','Straight-line correction / fix-line processing.',s.angleSnapping)}
          ${toggleRow('ripple','Ripple control','Sensor ripple filtering.',s.ripple)}
          ${toggleRow('highest-performance','Highest performance','Keep the sensor LED / engine in its highest-performance state.',s.performanceState)}
          <div class="setting-row"><div class="setting-copy"><b>Highest-performance duration</b><small>Timeout used by the performance state.</small></div><select id="performance-time" data-write>${sleepOptions}</select></div>
        </div>
      </div>
    </div>`;
}

function toggleRow(id, title, copy, value) {
  return `<div class="setting-row"><div class="setting-copy"><b>${esc(title)}</b><small>${esc(copy)}</small></div><label class="switch"><input id="${id}" type="checkbox" ${checked(Boolean(value))} data-write><span class="switch-track"></span><span class="switch-text">${value ? 'On' : 'Off'}</span></label></div>`;
}

function buttonSelection(button) {
  if (!button) return 'preserve';
  if (button.type === 5) return button.param < 16 ? `shortcut:${button.param}` : 'preserve';
  if (button.type === 6) return button.param < 16 ? `macro:${button.param}` : 'preserve';
  if (button.type === 4) return 'preserve';
  const exact = BUTTON_ACTIONS.find((a) => a.type === button.type && a.param === button.param);
  return exact?.key ?? 'preserve';
}

function buttonOptions(current) {
  const base = BUTTON_ACTIONS.map((x) => `<option value="${x.key}" ${selected(x.key,current)}>${esc(x.label)}</option>`).join('');
  const shortcuts = Array.from({length:16},(_,i)=>`<option value="shortcut:${i}" ${selected(`shortcut:${i}`,current)}>Shortcut / combo slot ${i+1}</option>`).join('');
  const macros = Array.from({length:16},(_,i)=>`<option value="macro:${i}" ${selected(`macro:${i}`,current)}>Macro slot ${i+1}</option>`).join('');
  return `<option value="preserve" ${selected('preserve',current)}>Keep current raw mapping</option>${base}<option value="fire" ${selected('fire',current)}>Firepower / rapid left click (Expert)…</option>${shortcuts}${macros}<option value="custom" ${selected('custom',current)}>Custom raw type / parameter</option>`;
}

function renderButtons() {
  const rows = physicalButtons(model.settings).map((button, i) => {
    const current = buttonSelection(button);
    return `<div class="button-map-row" data-button-row="${i}">
      <div><div class="button-name">${esc(button.name)}</div><div class="raw">#${i+1} · ${button.type != null ? `type 0x${button.type.toString(16).toUpperCase()} · param 0x${button.param.toString(16).padStart(4,'0').toUpperCase()}` : 'invalid checksum'}</div></div>
      <select data-button-action="${i}">${buttonOptions(current)}</select>
      <button class="button" data-save-button="${i}" data-write>Apply</button>
    </div>`;
  }).join('');
  return `${pageHead('Input', 'Button mapping', 'Map the five physical F1 AIR controls: left, right, wheel click, forward and backward.')}
    <div class="grid two">
      <div class="card">
        <div class="card-head"><div><h3>Onboard buttons</h3><p>Five physical controls. The sixth internal logical record is preserved in backups and Diagnostics.</p></div></div>
        <div class="button-map">${rows}</div>
      </div>
      <div class="card">
        <div class="card-head"><div><h3>Action helpers</h3><p>Use these helpers when a mapping needs parameters beyond a simple preset.</p></div></div>
        <div class="setting-list">
          <div class="setting-row"><div class="setting-copy"><b>Firepower</b><small>Vendor UI accepts 0–3 repeats and 10–255 ms interval. The common encoding is exposed here as an experimental type-4 parameter until captured from F1 AIR hardware.</small></div><div class="inline" style="gap:6px"><input id="fire-times" type="number" min="0" max="3" value="1"><input id="fire-interval" type="number" min="10" max="255" value="50"></div></div>
          <div class="setting-row"><div class="setting-copy"><b>Custom raw mapping</b><small>For newly discovered action IDs without changing the app.</small></div><div class="inline" style="gap:6px"><input id="custom-type" type="text" value="0x00"><input id="custom-param" type="text" value="0x0000"></div></div>
          <div class="setting-row"><div class="setting-copy"><b>Multimedia</b><small>Consumer-control usages are supported through shortcut slots. Pick an unused slot, write the usage, then map a button to that shortcut.</small></div><div class="inline" style="gap:6px"><select id="media-usage">${CONSUMER_KEYS.map(x=>`<option value="${x.usage}">${esc(x.label)}</option>`).join('')}</select><select id="media-slot">${Array.from({length:16},(_,i)=>`<option value="${i}">Slot ${i+1}</option>`).join('')}</select><button class="button tiny" id="write-media" data-write>Write</button></div></div>
        </div>
      </div>
    </div>`;
}

const HID_CODES = (() => {
  const map = {};
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').forEach((letter, i) => { map[`Key${letter}`] = { code:1, usage:4+i, label:letter }; });
  ['1','2','3','4','5','6','7','8','9','0'].forEach((n,i)=>{ map[`Digit${n}`] = {code:1,usage:30+i,label:n}; });
  Object.assign(map, {
    Enter:{code:1,usage:40,label:'Enter'}, Escape:{code:1,usage:41,label:'Esc'}, Backspace:{code:1,usage:42,label:'Backspace'},
    Tab:{code:1,usage:43,label:'Tab'}, Space:{code:1,usage:44,label:'Space'}, Minus:{code:1,usage:45,label:'-'}, Equal:{code:1,usage:46,label:'='},
    BracketLeft:{code:1,usage:47,label:'['}, BracketRight:{code:1,usage:48,label:']'}, Backslash:{code:1,usage:49,label:'\\'},
    Semicolon:{code:1,usage:51,label:';'}, Quote:{code:1,usage:52,label:"'"}, Backquote:{code:1,usage:53,label:'`'}, Comma:{code:1,usage:54,label:','}, Period:{code:1,usage:55,label:'.'}, Slash:{code:1,usage:56,label:'/'}, CapsLock:{code:1,usage:57,label:'Caps Lock'},
    F1:{code:1,usage:58,label:'F1'},F2:{code:1,usage:59,label:'F2'},F3:{code:1,usage:60,label:'F3'},F4:{code:1,usage:61,label:'F4'},F5:{code:1,usage:62,label:'F5'},F6:{code:1,usage:63,label:'F6'},F7:{code:1,usage:64,label:'F7'},F8:{code:1,usage:65,label:'F8'},F9:{code:1,usage:66,label:'F9'},F10:{code:1,usage:67,label:'F10'},F11:{code:1,usage:68,label:'F11'},F12:{code:1,usage:69,label:'F12'},
    ArrowRight:{code:1,usage:79,label:'→'},ArrowLeft:{code:1,usage:80,label:'←'},ArrowDown:{code:1,usage:81,label:'↓'},ArrowUp:{code:1,usage:82,label:'↑'},
    ControlLeft:{code:0,usage:1,label:'L Ctrl'},ShiftLeft:{code:0,usage:2,label:'L Shift'},AltLeft:{code:0,usage:4,label:'L Alt'},MetaLeft:{code:0,usage:8,label:'L Win'},ControlRight:{code:0,usage:16,label:'R Ctrl'},ShiftRight:{code:0,usage:32,label:'R Shift'},AltRight:{code:0,usage:64,label:'R Alt'},MetaRight:{code:0,usage:128,label:'R Win'},
  });
  return map;
})();

function macroEventLabel(event) {
  if (event.kind === 'mouse') {
    const m = MACRO_MOUSE_EVENTS.find((x)=>x.code===event.code && x.data1===event.data1 && x.data2===event.data2);
    return m?.label ?? `Mouse 0x${event.data2.toString(16)}`;
  }
  const match = Object.values(HID_CODES).find((x)=>x.code===event.code && x.usage===event.data1);
  return `${event.kind === 'key-down' ? '↓' : '↑'} ${match?.label ?? `HID ${event.data1}`}`;
}

function renderMacroEvents() {
  if (!app.macroDraft.events.length) return `<div class="notice info">No events yet. Record keyboard input or add a mouse event.</div>`;
  return app.macroDraft.events.map((event,i)=>`<div class="event-row" data-event-row="${i}">
    <select data-event-kind="${i}"><option value="key-down" ${selected('key-down',event.kind)}>Key press</option><option value="key-up" ${selected('key-up',event.kind)}>Key release</option><option value="mouse" ${selected('mouse',event.kind)}>Mouse command</option></select>
    <input data-event-code="${i}" type="number" min="0" max="15" value="${event.code ?? 0}" title="record type / low nibble">
    <input data-event-data="${i}" type="text" value="0x${Number(event.data1 ?? 0).toString(16).padStart(2,'0')} 0x${Number(event.data2 ?? 0).toString(16).padStart(2,'0')}" title="data bytes">
    <input data-event-delay="${i}" type="number" min="0" max="65535" value="${event.delayMs ?? 0}" title="delay after event, ms">
    <button class="button tiny danger" data-remove-event="${i}">×</button>
  </div>`).join('');
}

function renderMacros() {
  const slots = Array.from({length:16},(_,i)=>`<button class="slot-button ${i===app.selectedMacroSlot?'active':''}" data-macro-slot="${i}"><span>Macro ${String(i+1).padStart(2,'0')}</span><span>${model.macros.has(i) ? (model.macros.get(i).parsed.valid?'✓':'!') : '·'}</span></button>`).join('');
  const mouseOptions = MACRO_MOUSE_EVENTS.map((x,i)=>`<option value="${i}">${esc(x.label)}</option>`).join('');
  return `${pageHead('Automation', 'Macros & shortcuts', 'Edit the same 16 × 384-byte macro slots and 16 × 32-byte shortcut slots used by the vendor software. Macro event layout is recovered directly from HIDUsb.dll.')}
    <div class="macro-editor">
      <div class="card compact"><div class="card-head"><div><h3>Macro slots</h3><p>Read only the slot you edit.</p></div></div><div class="slot-list">${slots}</div></div>
      <div class="card">
        <div class="card-head"><div><h3>Macro ${app.selectedMacroSlot+1}</h3><p>${app.macroLoaded ? `Decoded ${app.macroDraft.events.length} events.` : 'Load the slot before editing so existing data is preserved.'}</p></div><div class="button-row"><button class="button tiny" id="load-macro">Load slot</button><button class="button tiny ${app.macroRecording?'active':''}" id="record-macro" ${app.macroLoaded?'':'disabled'}>${app.macroRecording?'Stop recording':'Record keys'}</button><button class="button tiny primary" id="save-macro" data-write ${app.macroLoaded?'':'disabled'}>Save</button></div></div>
        <div class="control"><label>Macro name</label><input id="macro-name" type="text" maxlength="30" value="${attr(app.macroDraft.name)}" ${app.macroLoaded?'':'disabled'}></div>
        <div class="between" style="margin:14px 0 7px"><div class="control-label">Events · 5 bytes each · max 70</div><div class="button-row"><select id="mouse-event">${mouseOptions}</select><button class="button tiny" id="add-mouse-event" ${app.macroLoaded?'':'disabled'}>Add mouse event</button><button class="button tiny" id="add-key-event" ${app.macroLoaded?'':'disabled'}>Add raw key</button></div></div>
        <div class="event-list" id="event-list">${renderMacroEvents()}</div>
        <div class="notice info" style="margin-top:14px">Loop/repeat policy in the vendor UI is not part of the recovered 384-byte event record itself; it appears to be encoded with the button-to-macro assignment. Until a F1 AIR capture verifies those parameter bits, this editor preserves macro content but does not invent a loop-policy encoding.</div>
      </div>
    </div>
    <div class="grid two" style="margin-top:14px">
      <div class="card"><div class="card-head"><div><h3>Shortcut / combo slot</h3><p>Short chord records used by button action type 5.</p></div></div>
        <div class="inline" style="gap:7px"><select id="shortcut-slot">${Array.from({length:16},(_,i)=>`<option value="${i}">Slot ${i+1}</option>`).join('')}</select><button class="button" id="load-shortcut">Load</button><button class="button primary" id="save-shortcut" data-write>Save raw</button></div>
        <div class="control" style="margin-top:10px"><label>Decoded / editable JSON events</label><textarea id="shortcut-json" rows="9">${esc(JSON.stringify(app.shortcutDraft,null,2))}</textarea></div>
      </div>
      <div class="card"><div class="card-head"><div><h3>Format notes</h3><p>Useful while validating captures against the vendor app.</p></div></div>
        <div class="table-wrap"><table><thead><tr><th>Region</th><th>Address</th><th>Size</th><th>Integrity</th></tr></thead><tbody>
          <tr><td>Shortcut slot</td><td>0x0100 + n×0x20</td><td>32 B</td><td>0x55 checksum</td></tr>
          <tr><td>Macro slot</td><td>0x0300 + n×0x180</td><td>384 B</td><td>0x55 checksum after last event</td></tr>
          <tr><td>Macro event</td><td>slot + 32</td><td>5 B</td><td>type/data/data/delay BE16</td></tr>
        </tbody></table></div>
      </div>
    </div>`;
}

function renderLighting() {
  const s = model.settings;
  const lb = s.lightBar ?? { mode:0,brightness:128,speed:3,color:'#ffffff',offTime:1 };
  const sleepOptions = SLEEP_CODES.map(x=>`<option value="${x.raw}" ${selected(x.raw,lb.offTime)}>${x.label}</option>`).join('');
  return `${pageHead('RGB', 'Lighting', 'DPI indicator, decorative light bar and receiver indicator controls.')}
    <div class="grid two">
      <div class="card">
        <div class="card-head"><div><h3>DPI indicator</h3><p>Mode, brightness and speed are four parity-protected bytes at 0x004C.</p></div></div>
        <div class="setting-list">
          <div class="setting-row"><div class="setting-copy"><b>Effect</b><small>DPI stage indicator effect.</small></div><select id="dpi-light-mode">${DPI_LIGHT_MODES.map(x=>`<option value="${x.raw}" ${selected(x.raw,s.dpiEffect.mode)}>${x.label}</option>`).join('')}</select></div>
          <div class="setting-row"><div class="setting-copy"><b>Brightness</b></div><input id="dpi-light-brightness" type="range" min="0" max="255" value="${s.dpiEffect.brightness ?? 128}"></div>
          <div class="setting-row"><div class="setting-copy"><b>Speed</b></div><input id="dpi-light-speed" type="range" min="0" max="10" value="${s.dpiEffect.speed ?? 3}"></div>
          <div class="setting-row"><div class="setting-copy"><b>Enabled</b></div><label class="switch"><input id="dpi-light-state" type="checkbox" ${checked(Boolean(s.dpiEffect.state))}><span class="switch-track"></span><span class="switch-text">${s.dpiEffect.state ? 'On':'Off'}</span></label></div>
        </div><div class="button-row" style="justify-content:flex-end;margin-top:12px"><button class="button primary" id="save-dpi-light" data-write>Apply DPI lighting</button></div>
      </div>
      <div class="card">
        <div class="card-head"><div><h3>Decorative light bar</h3><p>Six-byte lighting record + checksum + idle timeout pair at 0x00A0.</p></div></div>
        <div class="setting-list">
          <div class="setting-row"><div class="setting-copy"><b>Effect</b></div><select id="lightbar-mode">${DECORATIVE_LIGHT_MODES.map(x=>`<option value="${x.raw}" ${selected(x.raw,lb.mode)}>${x.label}</option>`).join('')}</select></div>
          <div class="setting-row"><div class="setting-copy"><b>Brightness</b></div><input id="lightbar-brightness" type="range" min="0" max="255" value="${lb.brightness ?? 128}"></div>
          <div class="setting-row"><div class="setting-copy"><b>Speed</b></div><input id="lightbar-speed" type="range" min="0" max="10" value="${lb.speed ?? 3}"></div>
          <div class="setting-row"><div class="setting-copy"><b>Color</b></div><input id="lightbar-color" type="color" value="${attr(lb.color ?? '#ffffff')}"></div>
          <div class="setting-row"><div class="setting-copy"><b>Idle light-off time</b></div><select id="lightbar-offtime">${sleepOptions}</select></div>
          ${toggleRow('moving-light-off','Turn off lights while moving','Vendor “MovingOffLight” setting at 0x00B3.',s.movingLightOff)}
        </div><div class="button-row" style="justify-content:flex-end;margin-top:12px"><button class="button primary" id="save-lightbar" data-write>Apply light bar</button></div>
      </div>
    </div>
    <div class="card" style="margin-top:14px">
      <div class="card-head"><div><h3>8K receiver indicator</h3><p>Read current state first. Assignment labels are candidates; writing raw receiver fields requires Expert writes.</p></div><button class="button" id="read-receiver-led">Read receiver</button></div>
      <div class="inline" style="gap:8px;max-width:720px"><select id="receiver-mode">${RECEIVER_INDICATOR_MODES.map(x=>`<option value="${x.raw}">Candidate: ${x.label}</option>`).join('')}</select><input id="receiver-arg1" type="number" min="0" max="255" value="0" title="raw arg1"><input id="receiver-arg2" type="number" min="0" max="255" value="0" title="raw arg2"><button class="button primary" id="save-receiver-led" data-write>Apply</button></div>
      <div id="receiver-readout" class="raw" style="margin-top:10px">Not read yet.</div>
    </div>`;
}

function renderProfiles() {
  const id = model.identity;
  const s = model.settings;
  const sleepOptions = SLEEP_CODES.map((x)=>`<option value="${x.raw}" ${selected(x.raw,s.sleepTime)}>${x.label}</option>`).join('');
  return `${pageHead('Onboard memory', 'Profiles & device', 'Switch onboard profiles, tune sleep behavior, pair a receiver and make complete JSON backups of the known flash regions.')}
    <div class="grid two">
      <div class="card">
        <div class="card-head"><div><h3>Profile & power</h3><p>Four onboard profiles are exposed by the protocol.</p></div><span class="tag blue">Active #${(id.profile ?? 0)+1}</span></div>
        <div class="setting-list">
          <div class="setting-row"><div class="setting-copy"><b>Active profile</b><small>Switching profiles reloads the profile flash.</small></div><select id="profile-select" data-write>${[0,1,2,3].map(p=>`<option value="${p}" ${selected(p,id.profile)}>Profile ${p+1}</option>`).join('')}</select></div>
          <div class="setting-row"><div class="setting-copy"><b>Sleep time</b><small>Idle time before the mouse enters sleep mode.</small></div><select id="sleep-time" data-write>${sleepOptions}</select></div>
          <div class="setting-row"><div class="setting-copy"><b>Long-distance mode</b><small>Separate receiver command, not profile flash.</small></div><label class="switch"><input id="profile-long-range" type="checkbox" ${checked(id.longRange)} data-write><span class="switch-track"></span><span class="switch-text">${id.longRange?'On':'Off'}</span></label></div>
        </div>
      </div>
      <div class="card">
        <div class="card-head"><div><h3>Backup / restore</h3><p>Backups contain the 232-byte base settings, 60K-DPI extension and optionally all shortcut/macro slots.</p></div></div>
        <div class="button-row"><button class="button primary" id="export-backup">Export full backup</button><button class="button" id="import-backup" data-write>Import backup…</button><button class="button danger" id="factory-reset" data-write>Factory reset</button></div>
        <div class="notice info" style="margin-top:14px">Import validates all region addresses, lengths, identity and active profile before writing. Normal restore preserves current candidate/unmapped bytes; Expert writes also restores those bytes from the backup. Hidden firmware records are retained.</div>
      </div>
    </div>
    <div class="grid two" style="margin-top:14px">
      <div class="card"><div class="card-head"><div><h3>Receiver pairing</h3><p>Vendor sequence: hold left + right + middle for 3 seconds, move close to receiver, then start pairing.</p></div></div><button class="button primary" id="profiles-pair" data-write>Start pairing</button><div id="pair-state" class="raw" style="margin-top:10px"></div></div>
      <div class="card"><div class="card-head"><div><h3>Firmware</h3><p>Version inspection is safe. Flash transfer is deliberately interlocked until the updater protocol is fully verified.</p></div><span class="tag warning">Research mode</span></div><div class="button-row"><button class="button" id="inspect-firmware">Inspect .bin…</button><button class="button" disabled title="Bootloader transfer not yet verified">Flash firmware</button></div><div id="firmware-info" class="raw" style="margin-top:10px">Mouse ${fmtVersion(id.mouseVersion)} · Receiver ${fmtVersion(id.dongleVersion)}</div></div>
    </div>`;
}

function renderDiagnostics() {
  const diag = model.diagnostics();
  const advanced = model.settings?.advanced ?? { pairs: {}, blocks: {} };
  const rows = Object.entries(advanced.pairs).map(([addr,value])=>`<tr><td>${addr}</td><td>pair</td><td>${value ?? 'invalid'}</td></tr>`).join('') + Object.entries(advanced.blocks).map(([addr,value])=>`<tr><td>${addr}</td><td>4 B + checksum</td><td>${value.valid ? `0x${(value.valueLE>>>0).toString(16).padStart(8,'0')}` : 'invalid'} · ${hex(value.bytes)}</td></tr>`).join('');
  const high = model.highResDpi.map((x,i)=>`<tr><td>${i+1}</td><td>0x${(ADDRESS.HIGH_RES_DPI+i*6).toString(16).toUpperCase()}</td><td>${x.parsed?.dpi ?? '—'}</td><td>${x.parsed?.flag != null ? `0x${x.parsed.flag.toString(16).toUpperCase()}` : '—'}</td><td class="mono">${hex(x.raw)}</td></tr>`).join('');
  const logs = hid.log.slice(-120).reverse().map(x=>`<div class="packet-line"><span>${x.time.toLocaleTimeString()}</span><b class="${x.direction}">${x.direction.toUpperCase()}</b><span>${x.body ? hex(x.body) : esc(x.note)} ${esc(x.note)}</span></div>`).join('');
  return `${pageHead('Reverse engineering', 'Diagnostics', 'Raw settings, high-resolution DPI records, currently-unidentified extended fields and live HID traffic.')}
    ${renderCaptureLab(captureLab, hid.connected && Boolean(model.identity && model.settings))}
    <div class="card" style="margin-bottom:14px"><div class="card-head"><div><h3>Read-only endpoint probes</h3><p>Version 0xB3 may differ from the official firmware display. Receiver lighting semantics remain unverified. Raw replies and endpoint errors are exported unchanged.</p></div></div><div class="button-row"><button class="button" id="probe-versions" ${disabled(!hid.connected)}>Read version endpoints</button><button class="button" id="probe-receiver" ${disabled(!hid.connected)}>Read receiver lighting</button><button class="button ghost" id="export-endpoints" ${disabled(!app.endpointCapture)}>Export endpoint JSON</button></div><pre class="hex-box">${app.endpointCapture ? esc(JSON.stringify(app.endpointCapture,null,2)) : 'No endpoints captured yet.'}</pre></div>
    <div class="grid two">
      <div class="card"><div class="card-head"><div><h3>F1 identity gate</h3><p>Writes are allowed automatically only for the profile evidenced by the bundled package.</p></div><span class="tag ${model.isVerifiedF1Air?'accent':'warning'}">${model.isVerifiedF1Air?'MATCH':'NO MATCH'}</span></div><div class="hex-box">${esc(JSON.stringify(diag.identity,null,2))}</div></div>
      <div class="card"><div class="card-head"><div><h3>High-resolution DPI table</h3><p>Eight six-byte PAW3955 records at 0x1B00.</p></div></div><div class="table-wrap"><table><thead><tr><th>Stage</th><th>Address</th><th>DPI</th><th>Flag</th><th>Raw</th></tr></thead><tbody>${high}</tbody></table></div></div>
    </div>
    <div class="grid two" style="margin-top:14px">
      <div class="card"><div class="card-head"><div><h3>Base settings dump</h3><p>232 bytes read from flash 0x0000–0x00E7.</p></div><button class="button tiny" id="copy-base">Copy</button></div><div class="hex-box">${diag.baseHex ? diag.baseHex.match(/.{1,48}/g).join('\n') : '—'}</div></div>
      <div class="card"><div class="card-head"><div><h3>Extended fields</h3><p>The DLL validates additional settings after SensorMode. Their integrity/layout is known; user-facing semantics still need captures.</p></div></div><div class="table-wrap"><table><thead><tr><th>Address</th><th>Layout</th><th>Value</th></tr></thead><tbody>${rows}</tbody></table></div></div>
    </div>
    <div class="card" style="margin-top:14px"><div class="card-head"><div><h3>Live HID log</h3><p>Report ID 8 is omitted; each line shows the 16-byte body. Invalid packets stay in the log but cannot complete requests.</p></div><div class="button-row"><button class="button tiny" id="download-log">Download log</button><button class="button tiny" id="clear-log">Clear</button></div></div><div class="packet-log" id="live-hid-log">${logs || 'No packets yet.'}</div></div>
    <div class="card" style="margin-top:14px"><div class="card-head"><div><h3>Expert flash read</h3><p>Read any address without writing it.</p></div></div><div class="inline" style="gap:7px;max-width:650px"><input id="raw-address" type="text" value="0x0000"><input id="raw-length" type="number" min="1" max="4096" value="16"><button class="button" id="raw-read">Read</button></div><div id="raw-result" class="hex-box" style="margin-top:10px">—</div></div>`;
}

function render() {
  setConnectionUi();
  $$('.nav-item').forEach((el) => el.classList.toggle('active', el.dataset.tab === app.tab));
  if (app.tab !== 'diagnostics' && (!hid.connected || !model.identity || !model.settings)) {
    content.innerHTML = emptyState();
    $('#empty-connect')?.addEventListener('click', connectDevice);
    return;
  }
  const renderers = { overview:renderOverview, sensor:renderSensor, buttons:renderButtons, macros:renderMacros, lighting:renderLighting, profiles:renderProfiles, diagnostics:renderDiagnostics };
  content.innerHTML = (renderers[app.tab] ?? renderOverview)();
  bindCurrentTab();
  if (app.busy) setBusy(true);
}

async function connectDevice() {
  if (hid.connected) {
    await run(async()=>{ await hid.setDriverActive(false).catch(()=>{}); await hid.close(); model.identity=null; model.base=null; model.settings=null; }, { rerender:true });
    return;
  }
  await run(async()=>{
    const ok = await hid.request();
    if (!ok) return;
    await model.initialize();
    await model.refreshIdentity();
  }, { success:'Mouse connected' });
}

function writePairControl(id, address, transform = (v)=>v) {
  $(id)?.addEventListener('change', (event)=> run(()=>model.writePair(address, transform(event.target.type==='checkbox' ? event.target.checked : event.target.value)), {write:true,success:'Setting saved'}));
}

function bindOverview() {
  $$('[data-profile]').forEach((el)=>el.addEventListener('click',()=>run(()=>model.setProfile(Number(el.dataset.profile)),{write:true,success:'Profile switched'})));
  $('#long-range')?.addEventListener('change',(e)=>run(()=>model.setLongRange(e.target.checked),{write:true,success:'Range mode updated'}));
  $('#pair-btn')?.addEventListener('click', pairFlow);
}

function bindSensor() {
  $$('[data-rate]').forEach((el)=>el.addEventListener('click',()=>run(()=>model.setPollingRate(Number(el.dataset.rate)),{write:true,success:`Polling set to ${el.dataset.rate} Hz`})));
  $('#stage-count')?.addEventListener('change',(e)=>run(()=>model.setStageCount(Number(e.target.value)),{write:true,success:'DPI stage count updated'}));
  $$('[data-stage]').forEach((el)=>el.addEventListener('click',()=>run(()=>model.setCurrentDpiStage(Number(el.dataset.stage)),{write:true,success:'Active DPI stage changed'})));
  $$('[data-save-dpi]').forEach((el)=>el.addEventListener('click',()=>{ const i=Number(el.dataset.saveDpi); const input=$(`[data-dpi-input="${i}"]`); run(()=>model.setDpi(i,Number(input.value)),{write:true,success:`Stage ${i+1} DPI saved`}); }));
  $$('[data-save-color]').forEach((el)=>el.addEventListener('click',()=>{ const i=Number(el.dataset.saveColor); const input=$(`[data-dpi-color="${i}"]`); run(()=>model.setDpiColor(i,input.value),{write:true,success:`Stage ${i+1} color saved`}); }));
  const debounce=$('#debounce'); debounce?.addEventListener('input',()=>{$('#debounce-label').textContent=`${debounce.value} ms`;}); debounce?.addEventListener('change',()=>run(()=>model.writePair(ADDRESS.DEBOUNCE,Number(debounce.value)),{write:true,success:'Debounce saved'}));
  writePairControl('#sensor-mode',ADDRESS.SENSOR_MODE,(v)=>Number(v));
  writePairControl('#lod-raw',ADDRESS.LOD,(v)=>Number(v));
  writePairControl('#motion-sync',ADDRESS.MOTION_SYNC,(v)=>v?1:0);
  writePairControl('#angle-snap',ADDRESS.ANGLE_SNAPPING,(v)=>v?1:0);
  writePairControl('#ripple',ADDRESS.RIPPLE,(v)=>v?1:0);
  writePairControl('#highest-performance',ADDRESS.PERFORMANCE_STATE,(v)=>v?1:0);
  writePairControl('#performance-time',ADDRESS.PERFORMANCE_TIME,(v)=>Number(v));
  writePairControl('#scan-20k',ADDRESS.SENSOR_STATIC_SCAN,(v)=>v?1:0);
  $('#save-rotation')?.addEventListener('click',()=>run(()=>model.writePair(0x0006,Number($('#sensor-rotation').value)),{write:true,success:'Experimental sensor rotation byte saved'}));
}

function bindButtons() {
  $$('[data-save-button]').forEach((el)=>el.addEventListener('click', async()=>{
    const i=Number(el.dataset.saveButton); const value=$(`[data-button-action="${i}"]`).value;
    await run(async()=>{
      if (value === 'preserve') return;
      if (value.startsWith('macro:')) return model.setButton(i,6,Number(value.split(':')[1]));
      if (value.startsWith('shortcut:')) return model.setButton(i,5,Number(value.split(':')[1]));
      if (value==='fire') {
        const times=Math.max(0,Math.min(3,Number($('#fire-times').value))); const interval=Math.max(10,Math.min(255,Number($('#fire-interval').value)));
        return model.setButton(i,4,(times<<8)|interval);
      }
      if (value==='custom') {
        const type=Number.parseInt($('#custom-type').value,0); const param=Number.parseInt($('#custom-param').value,0);
        if (!Number.isFinite(type)||!Number.isFinite(param)) throw new Error('Invalid custom type/parameter.');
        return model.setButton(i,type,param);
      }
      return model.setButtonPreset(i,value);
    },{write:true,success:`${model.settings.buttons[i].name} mapping saved`});
  }));
  $('#write-media')?.addEventListener('click',()=>run(async()=>{
    const slot=Number($('#media-slot').value); const usage=Number($('#media-usage').value);
    // Consumer-control shortcut convention: press/release pair using type 3 + usage16.
    await model.setShortcutSlot(slot,[
      {kind:'key-down',code:3,data1:usage&0xff,data2:(usage>>8)&0xff},
      {kind:'key-up',code:3,data1:usage&0xff,data2:(usage>>8)&0xff},
    ]);
  },{write:true,success:'Multimedia shortcut written; map a button to that shortcut slot.'}));
}

function parseDataBytes(text) {
  const bytes=parseHex(text); if(bytes.length<2) throw new Error('Enter two data bytes.'); return [bytes[0],bytes[1]];
}

function syncMacroDraftFromDom() {
  const name=$('#macro-name'); if(name) app.macroDraft.name=name.value;
  app.macroDraft.events = app.macroDraft.events.map((event,i)=>{
    const kind=$(`[data-event-kind="${i}"]`)?.value ?? event.kind;
    const code=Number($(`[data-event-code="${i}"]`)?.value ?? event.code);
    const [data1,data2]=parseDataBytes($(`[data-event-data="${i}"]`)?.value ?? '00 00');
    const delayMs=Number($(`[data-event-delay="${i}"]`)?.value ?? event.delayMs);
    return {kind,code,data1,data2,delayMs};
  });
}

function bindMacros() {
  $$('[data-macro-slot]').forEach((el)=>el.addEventListener('click',()=>{ if(app.macroRecording)return; app.selectedMacroSlot=Number(el.dataset.macroSlot); app.macroLoaded=false; app.macroDraft={name:`Macro ${String(app.selectedMacroSlot+1).padStart(2,'0')}`,events:[]}; render(); }));
  $('#load-macro')?.addEventListener('click',()=>run(async()=>{ const result=await model.getMacroSlot(app.selectedMacroSlot,true); app.macroDraft={name:result.parsed.name||`Macro ${app.selectedMacroSlot+1}`,events:result.parsed.events}; app.macroLoaded=true; },{success:'Macro slot loaded'}));
  $('#save-macro')?.addEventListener('click',()=>run(async()=>{ if (!app.macroLoaded) throw new Error('Load the macro slot before saving.'); syncMacroDraftFromDom(); await model.setMacroSlot(app.selectedMacroSlot,app.macroDraft); },{write:true,success:'Macro saved'}));
  $('#add-mouse-event')?.addEventListener('click',()=>{ syncMacroDraftFromDom(); const source=MACRO_MOUSE_EVENTS[Number($('#mouse-event').value)]; app.macroDraft.events.push({kind:'mouse',code:source.code,data1:source.data1,data2:source.data2,delayMs:10}); render(); });
  $('#add-key-event')?.addEventListener('click',()=>{ syncMacroDraftFromDom(); app.macroDraft.events.push({kind:'key-down',code:1,data1:4,data2:0,delayMs:10}); render(); });
  $$('[data-remove-event]').forEach((el)=>el.addEventListener('click',()=>{ syncMacroDraftFromDom(); app.macroDraft.events.splice(Number(el.dataset.removeEvent),1); render(); }));
  $('#record-macro')?.addEventListener('click',()=>{ syncMacroDraftFromDom(); app.macroRecording=!app.macroRecording; app.macroRecordStartedAt=performance.now(); app.macroLastAt=app.macroRecordStartedAt; render(); if(app.macroRecording) toast('Recording keyboard events. Click “Stop recording” when finished.'); });
  $('#load-shortcut')?.addEventListener('click',()=>run(async()=>{ app.selectedShortcutSlot=Number($('#shortcut-slot').value); const result=await model.getShortcutSlot(app.selectedShortcutSlot,true); app.shortcutDraft=result.parsed.events; },{success:'Shortcut loaded'}));
  $('#save-shortcut')?.addEventListener('click',()=>run(async()=>{ const slot=Number($('#shortcut-slot').value); const events=JSON.parse($('#shortcut-json').value); if(!Array.isArray(events))throw new Error('Shortcut JSON must be an array.'); await model.setShortcutSlot(slot,events); app.shortcutDraft=events; },{write:true,success:'Shortcut saved'}));
}

function bindLighting() {
  $('#save-dpi-light')?.addEventListener('click',()=>run(()=>model.setDpiEffect({mode:Number($('#dpi-light-mode').value),brightness:Number($('#dpi-light-brightness').value),speed:Number($('#dpi-light-speed').value),state:$('#dpi-light-state').checked?1:0}),{write:true,success:'DPI lighting saved'}));
  $('#save-lightbar')?.addEventListener('click',()=>run(()=>model.setLightBar({mode:Number($('#lightbar-mode').value),brightness:Number($('#lightbar-brightness').value),speed:Number($('#lightbar-speed').value),color:$('#lightbar-color').value,offTime:Number($('#lightbar-offtime').value)}),{write:true,success:'Light bar saved'}));
  writePairControl('#moving-light-off',ADDRESS.MOVING_LIGHT_OFF,(v)=>v?1:0);
  $('#read-receiver-led')?.addEventListener('click',()=>run(async()=>{ const value=await model.getReceiverIndicator(); $('#receiver-mode').value=String(value.mode); $('#receiver-arg1').value=String(value.arg1); $('#receiver-arg2').value=String(value.arg2); $('#receiver-readout').textContent=`mode=${value.mode}, arg1=${value.arg1}, arg2=${value.arg2} · ${hex(value.raw)}`; },{rerender:false,success:'Receiver indicator read'}));
  $('#save-receiver-led')?.addEventListener('click',()=>run(async()=>{ const value=await model.setReceiverIndicator(Number($('#receiver-mode').value),Number($('#receiver-arg1').value),Number($('#receiver-arg2').value)); toast(`Receiver read-back: mode ${value.mode}`,'success'); },{write:true,rerender:false}));
}

async function pairFlow() {
  await run(async()=>{
    await model.pairReceiver();
    let last=null;
    for(let i=0;i<12;i+=1){ await new Promise(r=>setTimeout(r,500)); last=await hid.getPairState(); if(last.status!==0)break; }
    if(last) toast(`Pair state ${last.status}; timer ${last.seconds}s`,'success');
  },{write:true,rerender:false});
}

function bindProfiles() {
  $('#profile-select')?.addEventListener('change',(e)=>run(()=>model.setProfile(Number(e.target.value)),{write:true,success:'Profile switched'}));
  writePairControl('#sleep-time',ADDRESS.SLEEP_TIME,(v)=>Number(v));
  $('#profile-long-range')?.addEventListener('change',(e)=>run(()=>model.setLongRange(e.target.checked),{write:true,success:'Range mode updated'}));
  $('#export-backup')?.addEventListener('click',()=>run(async()=>{ const data=await model.createBackup({includeMacros:true,includeShortcuts:true}); download(`f1-air-backup-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(data,null,2),'application/json'); },{success:'Backup exported',rerender:false}));
  $('#import-backup')?.addEventListener('click',()=>backupFile.click());
  $('#factory-reset')?.addEventListener('click',async()=>{ if(await confirmAction('Factory reset mouse?','This asks the device firmware to restore its current configuration to defaults. Export a backup first if you may want to restore it.')) run(()=>model.restoreFactory(),{write:true,success:'Factory reset command completed'}); });
  $('#profiles-pair')?.addEventListener('click',pairFlow);
  $('#inspect-firmware')?.addEventListener('click',()=>firmwareFile.click());
}

function bindDiagnostics() {
  bindCaptureLab(content, captureLab, { hid, run, render, download });
  for (const group of ['versions', 'receiver']) $(`#probe-${group}`)?.addEventListener('click', () => run(async () => { app.endpointCapture = await captureEndpoints(hid, group, captureLab.notes); }));
  $('#export-endpoints')?.addEventListener('click', () => download(`f1-air-${app.endpointCapture.group}-endpoints.json`, JSON.stringify(app.endpointCapture,null,2), 'application/json'));
  $('#copy-base')?.addEventListener('click',async()=>{ await navigator.clipboard.writeText(model.diagnostics().baseHex || ''); toast('Base dump copied','success'); });
  $('#download-log')?.addEventListener('click',()=>download('f1-air-hid-log.txt',hid.exportLog(),'text/plain'));
  $('#clear-log')?.addEventListener('click',()=>{hid.log.length=0;render();});
  $('#raw-read')?.addEventListener('click',()=>run(async()=>{ const address=Number($('#raw-address').value); const length=Number($('#raw-length').value); if(!Number.isInteger(length)||length<1||length>4096)throw new Error('Read length must be 1–4096 bytes.'); const bytes=await hid.readFlash(address,length); $('#raw-result').textContent=hex(bytes); },{rerender:false}));
}

let logFrame = null;
model.addEventListener('profilechange', () => {
  app.macroLoaded = false;
  app.macroRecording = false;
  app.macroDraft = { name: 'Macro 01', events: [] };
  app.shortcutDraft = [];
});
hid.addEventListener('log', () => {
  if (app.tab !== 'diagnostics' || logFrame !== null) return;
  logFrame = requestAnimationFrame(() => {
    logFrame = null;
    const log = $('#live-hid-log');
    if (log) log.textContent = hid.exportLog().split('\n').slice(-120).reverse().join('\n');
  });
});

function bindCurrentTab() {
  const binders={overview:bindOverview,sensor:bindSensor,buttons:bindButtons,macros:bindMacros,lighting:bindLighting,profiles:bindProfiles,diagnostics:bindDiagnostics};
  binders[app.tab]?.();
}

function recordKeyboardEvent(event, kind) {
  if (!app.macroRecording || app.tab !== 'macros') return;
  if (event.repeat) return;
  if (event.code === 'Escape') { app.macroRecording=false; render(); return; }
  const spec=HID_CODES[event.code]; if(!spec)return;
  event.preventDefault();
  const now=performance.now(); const delay=Math.min(65535,Math.max(0,Math.round(now-app.macroLastAt))); app.macroLastAt=now;
  app.macroDraft.events.push({kind,code:spec.code,data1:spec.usage,data2:0,delayMs:delay});
  if(app.macroDraft.events.length>=70){app.macroRecording=false;toast('Macro reached the 70-event device limit.');}
  render();
}

document.addEventListener('keydown',(e)=>recordKeyboardEvent(e,'key-down'),true);
document.addEventListener('keyup',(e)=>recordKeyboardEvent(e,'key-up'),true);

$('#nav').addEventListener('click',(event)=>{const button=event.target.closest('[data-tab]');if(!button)return;app.tab=button.dataset.tab;render();});
connectBtn.addEventListener('click',connectDevice);
refreshBtn.addEventListener('click',()=>run(async()=>{await model.refreshIdentity();await model.refreshSettings();},{success:'Device state refreshed'}));

backupFile.addEventListener('change',async()=>{
  const file=backupFile.files?.[0]; backupFile.value=''; if(!file)return;
  try { const backup=JSON.parse(await file.text()); if(!await confirmAction('Import onboard backup?','This restores validated regions to the same device identity and active profile. Candidate/unmapped bytes remain unchanged unless Expert writes is enabled. Keep Control HUB closed during restore.'))return; await run(()=>model.restoreBackup(backup),{write:true,success:'Backup restored'}); } catch(error){toast(error.message,'error');}
});

firmwareFile.addEventListener('change',async()=>{
  const file=firmwareFile.files?.[0]; firmwareFile.value=''; if(!file)return;
  const bytes=new Uint8Array(await file.arrayBuffer());
  app.firmwareInspection={name:file.name,size:bytes.length,head:hex(bytes.slice(0,32)),tail:hex(bytes.slice(-16))};
  const info=$('#firmware-info'); if(info)info.textContent=`${file.name} · ${bytes.length.toLocaleString()} bytes · head ${app.firmwareInspection.head}`;
  toast('Firmware image inspected only; nothing was written to the device.','success');
});

expertWrites.addEventListener('change',()=>{model.expertWrites=expertWrites.checked; if(expertWrites.checked)toast('Expert writes enabled for unverified devices and candidate fields.');});

hid.addEventListener('disconnected',()=>{model.identity=null;model.base=null;model.settings=null;model.highResDpi=[];model.macros.clear();model.shortcuts.clear();model.expertWrites=false;expertWrites.checked=false;app.macroLoaded=false;render();});
navigator.hid?.addEventListener?.('disconnect',(event)=>{if(hid.device===event.device){hid.close().catch(()=>{});}});

if (!('hid' in navigator)) $('#unsupported-browser').classList.remove('hidden');

(async()=>{
  setConnectionUi(); render();
  if ('hid' in navigator) {
    try {
      const reconnected=await hid.reconnectAuthorized();
      if(reconnected){ await model.initialize(); await model.refreshIdentity(); toast('Reconnected to previously authorized F1 AIR.','success'); render(); }
    } catch(error){ console.warn('Auto-reconnect failed',error); }
  }
})();

console.info(`${APP_NAME}: ready`);
