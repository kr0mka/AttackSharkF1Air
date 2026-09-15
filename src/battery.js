// F1 AIR battery calibration recovered from the supplied vendor package.
// usersetting/Config.ini supplies 21 voltage thresholds (0..100% in 5% bands),
// and HIDUsb.dll's battery optimizer interpolates each band in 1% steps.
export const F1_AIR_BATTERY_MV = Object.freeze([
  3050, 3170, 3230, 3300, 3600, 3660, 3720,
  3760, 3800, 3840, 3880, 3920, 3940, 3960,
  3980, 4000, 4020, 4040, 4060, 4080, 4110,
]);

export function calibratedBatteryPercent(millivolts, charging = false, thresholds = F1_AIR_BATTERY_MV) {
  const mv = Math.round(Number(millivolts));
  if (!Number.isFinite(mv) || !Array.isArray(thresholds) || thresholds.length < 2) return null;

  // HIDUsb.dll caps a charging mouse at 99% until charge-complete, otherwise 100%.
  if (mv >= thresholds[thresholds.length - 1]) return charging ? 99 : 100;

  for (let i = 0; i < thresholds.length; i += 1) {
    if (mv >= thresholds[i]) continue;
    if (i === 0) return 1;

    const lower = thresholds[i - 1];
    const upper = thresholds[i];
    const onePercentMv = Math.trunc((upper - lower) / 5);
    if (onePercentMv <= 0) return null;

    let percent = (i - 1) * 5 + Math.trunc((mv - lower) / onePercentMv);

    // These two exact-value adjustments are present in the vendor DLL.
    if (percent === 5 || percent === 15) percent += 1;
    return Math.max(1, Math.min(100, percent));
  }

  return charging ? 99 : 100;
}
