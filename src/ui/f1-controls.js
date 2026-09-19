import { PHYSICAL_BUTTON_COUNT } from '../constants.js';
import { F1_AIR_LOD_LEVELS, lodLevelForRaw } from '../lod.js';

export function lodOptions(raw) {
  const options = F1_AIR_LOD_LEVELS.map((level) => `<option value="${level.raw}" ${level.raw === raw ? 'selected' : ''}>${level.mm.toFixed(1)} mm</option>`);
  if (!lodLevelForRaw(raw)) options.push(`<option value="${Number.isInteger(raw) ? raw : ''}" selected>Unknown raw ${Number.isInteger(raw) ? raw : '(invalid record)'}</option>`);
  return options.join('');
}

export function physicalButtons(settings) {
  return settings.buttons.slice(0, PHYSICAL_BUTTON_COUNT);
}
