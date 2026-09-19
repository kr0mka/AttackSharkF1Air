import { RECEIVER_INDICATOR_MODES } from '../constants.js';
import { hex } from '../codecs.js';

export function renderReceiverLighting(state) {
  const loaded = state?.assignments?.length === 3;
  return `<div class="card" style="margin-top:14px">
    <div class="card-head"><div><h3>8K receiver LEDs</h3><p>Three independent assignments. Labels are candidates from the vendor resources; physical behavior needs capture verification. Expert writes required.</p></div><button class="button" id="read-receiver-led">Read receiver</button></div>
    ${[0, 1, 2].map((index) => {
      const value = loaded ? state.assignments[index] : null;
      const known = RECEIVER_INDICATOR_MODES.some((option) => option.raw === value);
      return `<div class="setting-row"><label for="receiver-led-${index}">LED ${index + 1}</label><div class="inline" style="gap:8px">
        <select id="receiver-led-${index}" ${loaded ? '' : 'disabled'}>
          ${!loaded ? '<option value="">Read receiver first</option>' : !known ? `<option value="${value}" selected>Keep unknown raw ${value}</option>` : ''}
          ${RECEIVER_INDICATOR_MODES.map((option) => `<option value="${option.raw}" ${option.raw === value ? 'selected' : ''}>Candidate: ${option.label}</option>`).join('')}
        </select><button class="button" data-save-receiver-led="${index}" data-write ${loaded ? '' : 'disabled'}>Apply LED ${index + 1}</button>
      </div></div>`;
    }).join('')}
    <div id="receiver-readout" class="raw" style="margin-top:10px">${loaded ? `Assignment bytes: ${hex(state.assignments)} · reply: ${hex(state.raw)}` : 'Not read yet.'}</div>
  </div>`;
}
