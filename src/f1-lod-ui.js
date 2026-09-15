import { F1_AIR_LOD_LEVELS, lodLevelForRaw } from './lod.js';

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
  if (title) title.textContent = 'Lift-off distance (LOD)';
  if (copy) {
    copy.textContent = 'Verified on F1 AIR CID 124 / MID 20: raw 1–5 map to 0.7, 0.9, 1.2, 1.4 and 1.6 mm.';
  }
}

const content = document.querySelector('#content');
if (content) {
  new MutationObserver(applyVerifiedLodUi).observe(content, { childList: true, subtree: true });
}

applyVerifiedLodUi();
