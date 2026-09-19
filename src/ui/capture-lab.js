import { CAPTURE_PRESETS } from '../protocol-map.js';
import { captureSnapshot, makeComparison, parseCaptureFile } from '../capture.js';

const esc = (value) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
const hex = (value, size = 2) => `0x${value.toString(16).padStart(size, '0').toUpperCase()}`;
const disabled = (value) => value ? 'disabled' : '';
const PAGE_SIZE = 100;

export function createCaptureLabState() {
  return { preset: 'base', notes: '', before: null, after: null, comparison: null, page: 0 };
}

function snapshotSummary(snapshot) {
  if (!snapshot) return 'Not captured.';
  const id = snapshot.identity;
  return `${snapshot.createdAt} · ${id.productName} · PID ${hex(id.productId, 4)} · CID ${id.cid} / MID ${id.mid} · profile ${snapshot.activeProfile + 1}`;
}

export function renderCaptureLab(state, connected) {
  const preset = CAPTURE_PRESETS[state.preset];
  const diff = state.comparison?.diff;
  const rows = diff?.slice(state.page * PAGE_SIZE, (state.page + 1) * PAGE_SIZE).map((change) => `<tr><td class="mono">${hex(change.address, 4)}</td><td class="mono">${hex(change.before)}</td><td class="mono">${hex(change.after)}</td><td>${esc(change.field)}</td><td>${esc(change.confidence)}</td></tr>`).join('');
  return `<div class="card capture-lab" id="capture-lab">
    <div class="card-head"><div><h3>Protocol capture lab</h3><p>Read a baseline, change exactly one visible setting in Control HUB, then read the same region and compare.</p></div><span class="tag blue">Read only</span></div>
    <ol class="capture-steps"><li>Choose a preset and capture baseline. Export it before leaving this page.</li><li>Disconnect Open Control, change one official setting, then close or disconnect Control HUB.</li><li>Reconnect the same device and profile, capture after, and compare. Keep settings unchanged while each read runs.</li></ol>
    <div class="grid two">
      <div class="control"><label for="capture-preset">Region preset</label><select id="capture-preset">${Object.entries(CAPTURE_PRESETS).map(([key, value]) => `<option value="${key}" ${key === state.preset ? 'selected' : ''}>${esc(value.label)}</option>`).join('')}</select><small id="capture-range">${hex(preset.address, 4)}–${hex(preset.address + preset.length - 1, 4)} · ${preset.length} bytes</small></div>
      <div class="control"><label for="capture-notes">Single setting changed / official values</label><input id="capture-notes" type="text" maxlength="2000" placeholder="Example: visible setting, old value → new value" value="${esc(state.notes)}"></div>
    </div>
    <p class="raw">Lighting includes stage colors and moving-light-off plus intervening bytes. Receiver LEDs use commands, so flash alone cannot capture them. For macro repeat policies, also capture Buttons.</p>
    <div class="button-row"><button class="button primary" id="capture-before" ${disabled(!connected)}>Capture baseline</button><button class="button" id="capture-after" ${disabled(!connected || !state.before)}>Capture after</button><button class="button" id="capture-compare" ${disabled(!state.before || !state.after)}>Compare</button><button class="button ghost" id="capture-export" ${disabled(!state.before)}>Export JSON</button><button class="button ghost" id="capture-import">Import JSON</button><input id="capture-file" type="file" accept="application/json,.json" hidden></div>
    <div id="capture-progress" class="raw" role="status"></div>
    <div class="capture-snapshots"><p><b>Baseline:</b> ${esc(snapshotSummary(state.before))}</p><p><b>After:</b> ${esc(snapshotSummary(state.after))}</p></div>
    <p id="capture-summary" role="status">${diff ? `${diff.length} changed bytes${diff.length === 0 ? ' — no differences in the selected region' : ''}. Labels describe current evidence; candidate fields remain unproven.` : 'Capture or import both snapshots, then compare.'}</p>
    ${diff ? `<div class="table-wrap"><table><thead><tr><th>Address</th><th>Before</th><th>After</th><th>Protocol field</th><th>Confidence</th></tr></thead><tbody>${rows || '<tr><td colspan="5">No changed bytes.</td></tr>'}</tbody></table></div>${diff.length > PAGE_SIZE ? `<div class="button-row"><button class="button tiny" id="capture-prev" ${disabled(state.page === 0)}>Previous</button><span>Page ${state.page + 1} of ${Math.ceil(diff.length / PAGE_SIZE)}</span><button class="button tiny" id="capture-next" ${disabled((state.page + 1) * PAGE_SIZE >= diff.length)}>Next</button></div>` : ''}` : ''}
  </div>`;
}

export function bindCaptureLab(root, state, { hid, run, render, download }) {
  const $ = (selector) => root.querySelector(selector);
  $('#capture-notes').addEventListener('input', (event) => { state.notes = event.target.value; });
  $('#capture-preset').addEventListener('change', (event) => {
    state.preset = event.target.value;
    state.before = state.after = state.comparison = null;
    state.page = 0;
    render();
  });
  const capture = async (side) => {
    const snapshot = await captureSnapshot(hid, state.preset, {
      label: side === 'before' ? 'Baseline' : 'After', notes: state.notes,
      onProgress: (done, total) => { $('#capture-progress').textContent = `Reading ${done} / ${total} bytes…`; },
    });
    if (side === 'after') makeComparison(state.before, snapshot, state.notes);
    state[side] = snapshot;
    if (side === 'before') state.after = null;
    state.comparison = null;
    state.page = 0;
  };
  $('#capture-before').addEventListener('click', () => run(() => capture('before'), { success: 'Baseline captured' }));
  $('#capture-after').addEventListener('click', () => run(() => capture('after'), { success: 'After snapshot captured' }));
  $('#capture-compare').addEventListener('click', () => run(() => {
    state.comparison = makeComparison(state.before, state.after, state.notes);
    state.page = 0;
  }));
  $('#capture-export').addEventListener('click', () => run(() => {
    const data = state.after ? makeComparison(state.before, state.after, state.notes) : { ...state.before, notes: state.notes };
    download(`f1-air-${state.preset}-${state.after ? 'comparison' : 'baseline'}.json`, JSON.stringify(data, null, 2), 'application/json');
  }, { rerender: false }));
  $('#capture-import').addEventListener('click', () => $('#capture-file').click());
  $('#capture-file').addEventListener('change', (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    run(async () => {
      if (file.size > 2_000_000) throw new Error('Capture file is too large.');
      const imported = parseCaptureFile(await file.text());
      // Imported ranges may be inspected/exported, but only supported presets
      // can be recaptured by this UI. Do not silently switch their addresses.
      const preset = CAPTURE_PRESETS[imported.before.preset];
      const region = imported.before.regions[imported.before.preset];
      if (!preset || !region || Object.keys(imported.before.regions).length !== 1 || region.address !== preset.address || region.length !== preset.length) {
        throw new Error('Imported capture does not match a supported preset range.');
      }
      Object.assign(state, imported, { preset: imported.before.preset, notes: String(imported.comparison?.notes ?? imported.before.notes ?? ''), page: 0 });
    }, { success: 'Capture imported' });
  });
  $('#capture-prev')?.addEventListener('click', () => { state.page -= 1; render(); });
  $('#capture-next')?.addEventListener('click', () => { state.page += 1; render(); });
}
