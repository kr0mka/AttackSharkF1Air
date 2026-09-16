import { F1_AIR_LOD_LEVELS, lodLevelForRaw } from './lod.js';

const TITLE = 'Lift-off distance (LOD)';
const COPY = 'Verified on F1 AIR CID 124 / MID 20: raw 1–5 map to 0.7, 0.9, 1.2, 1.4 and 1.6 mm.';

function applyVerifiedLodUi() {
  const select = document.querySelector('#lod-raw');
  if (!select) return;

  const currentRaw = Number(select.value);
  if (select.dataset.verifiedF1AirLod !== '1') {
    select.replaceChildren(...F1_AIR_LOD_LEVELS.map(({ raw, mm }) => {
      const option = document.createElement('option');
      option.value = String(raw);
      option.textContent = `${mm.toFixed(1)} mm`;
      return option;
    }));

    if (!lodLevelForRaw(currentRaw)) {
      const option = document.createElement('option');
      option.value = String(currentRaw);
      option.textContent = `Unknown raw ${currentRaw}`;
      select.append(option);
    }

    select.dataset.verifiedF1AirLod = '1';
  }

  select.value = String(currentRaw);

  const row = select.closest('.setting-row');
  const title = row?.querySelector('.setting-copy b');
  const copy = row?.querySelector('.setting-copy small');

  // Keep this helper idempotent. Reassigning textContent creates child-list
  // mutations even when the visible text is unchanged, which previously fed
  // back into the observer and locked the Sensor tab in an infinite loop.
  if (title && title.textContent !== TITLE) title.textContent = TITLE;
  if (copy && copy.textContent !== COPY) copy.textContent = COPY;
}

const content = document.querySelector('#content');
if (content) {
  // app.js replaces #content itself whenever tabs/settings are re-rendered.
  // Observing only direct children is sufficient and deliberately excludes
  // the LOD row mutations performed by this helper.
  new MutationObserver(() => queueMicrotask(applyVerifiedLodUi))
    .observe(content, { childList: true });
}

applyVerifiedLodUi();
