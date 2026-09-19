import { ADDRESS, BASE_SETTINGS_SIZE, DPI_STAGE_COUNT, MACRO_SLOT_COUNT, MACRO_SLOT_SIZE, SHORTCUT_SLOT_COUNT, SHORTCUT_SLOT_SIZE } from '../constants.js';
import { fromBase64 } from '../codecs.js';
import { fieldForAddress } from '../protocol-map.js';

export const BACKUP_REGIONS = Object.freeze({
  base: { address: 0, length: BASE_SETTINGS_SIZE },
  highResDpi: { address: ADDRESS.HIGH_RES_DPI, length: DPI_STAGE_COUNT * 6 },
  shortcuts: { address: ADDRESS.SHORTCUTS, length: SHORTCUT_SLOT_COUNT * SHORTCUT_SLOT_SIZE },
  macros: { address: ADDRESS.MACROS, length: MACRO_SLOT_COUNT * MACRO_SLOT_SIZE },
});

export function validateBackupRegions(backup, identity) {
  // Keep the historic 'airi' spelling for compatibility with exported v1 files.
  if (backup?.schema !== 'attackshark-f1-airi-backup/v1') throw new Error('Unsupported backup schema.');
  for (const key of ['vendorId', 'productId', 'cid', 'mid']) {
    if (!Number.isInteger(backup.identity?.[key]) || backup.identity[key] !== identity?.[key]) {
      throw new Error(`Backup identity mismatch or missing field: ${key}.`);
    }
  }
  if (!Number.isInteger(backup.activeProfile) || backup.activeProfile < 0 || backup.activeProfile > 3) throw new Error('Invalid backup active profile.');
  if (!backup.regions?.base || !backup.regions?.highResDpi) throw new Error('Backup is missing required regions.');
  const validated = [];
  for (const name of Object.keys(backup.regions)) {
    if (!Object.hasOwn(BACKUP_REGIONS, name)) throw new Error(`Unsupported backup region: ${name}.`);
  }
  for (const [name, expected] of Object.entries(BACKUP_REGIONS)) {
    const region = backup.regions[name];
    if (!region) continue;
    if (region.address !== expected.address) throw new Error(`Invalid backup address: ${name}.`);
    if (typeof region.data !== 'string' || region.data.length !== 4 * Math.ceil(expected.length / 3) || !/^[A-Za-z0-9+/]*={0,2}$/.test(region.data)) {
      throw new Error(`Invalid backup data: ${name}.`);
    }
    const bytes = fromBase64(region.data);
    if (bytes.length !== expected.length) throw new Error(`Invalid backup length: ${name}.`);
    validated.push({ name, address: expected.address, bytes });
  }
  return validated;
}

// Return only spans permitted in normal mode. Unknown/candidate bytes remain
// untouched on the device, and remain available in the full backup file.
export function restoreSpans(region, expert = false) {
  const spans = [];
  let start = null;
  for (let offset = 0; offset <= region.bytes.length; offset += 1) {
    const field = fieldForAddress(region.address + offset);
    const allowed = offset < region.bytes.length && (expert || ['verified', 'likely'].includes(field?.confidence));
    if (allowed && start === null) start = offset;
    if (!allowed && start !== null) {
      spans.push({ address: region.address + start, bytes: region.bytes.slice(start, offset) });
      start = null;
    }
  }
  return spans;
}
