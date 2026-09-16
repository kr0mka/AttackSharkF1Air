import { PHYSICAL_BUTTON_COUNT } from './constants.js';

const content = document.querySelector('#content');

function applyPhysicalButtonUi() {
  if (!content) return;
  const rows = [...content.querySelectorAll('[data-button-row]')];
  if (!rows.length) return;

  for (const row of rows) {
    const index = Number(row.dataset.buttonRow);
    if (Number.isFinite(index) && index >= PHYSICAL_BUTTON_COUNT) row.hidden = true;
  }

  const pageCopy = content.querySelector('.page-head p');
  const expectedPageCopy = 'Map the five physical F1 AIR controls: left, right, wheel click, forward and backward.';
  if (pageCopy && pageCopy.textContent !== expectedPageCopy) pageCopy.textContent = expectedPageCopy;

  const buttonCard = content.querySelector('.button-map')?.closest('.card');
  const cardCopy = buttonCard?.querySelector('.card-head p');
  const expectedCardCopy = 'Five physical controls are exposed here. Flash still contains a sixth internal logical slot, which is preserved but intentionally hidden.';
  if (cardCopy && cardCopy.textContent !== expectedCardCopy) cardCopy.textContent = expectedCardCopy;
}

if (content) {
  // app.js replaces the direct children of #content on every tab render.
  // Do not observe the subtree: UI post-processing must never retrigger itself.
  new MutationObserver(() => queueMicrotask(applyPhysicalButtonUi))
    .observe(content, { childList: true });
}

applyPhysicalButtonUi();
