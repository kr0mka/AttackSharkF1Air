# F1 AIR battery percentage calibration

The F1 AIR receiver's `0x04` battery reply contains both a raw percentage byte and battery voltage. The official desktop application does **not** display the raw percentage directly for this model; it applies the model's voltage calibration curve through the vendor DLL's battery-optimization routine.

## Captured example

Real F1 AIR / MID 20 reply:

```text
04 00 00 00 02 37 00 0F 32 00 00 00 00 00 00 CF
```

Relevant fields:

- raw firmware percentage: `0x37` = **55%**
- charging: `0x00` = no
- voltage: `0x0F32` = **3890 mV**

At the same time, the official Attack Shark application displayed **51%**.

## Model curve

The supplied F1 AIR profile (`usersetting/Config.ini`, MID 20) contains this `BatteryParam` table:

```text
3050,3170,3230,3300,3600,3660,3720,3760,3800,3840,3880,
3920,3940,3960,3980,4000,4020,4040,4060,4080,4110
```

The 21 values describe 5-percentage-point bands from the low end through 100%.

The recovered `HIDUsb.dll` battery optimizer finds the voltage band and divides the voltage span of that band by five to obtain 1%-steps. It then interpolates the battery percentage within the band. It also contains two observed compatibility quirks: calculated 5% and 15% are promoted to 6% and 16%, respectively. At or above the last voltage point, it reports 100% when not charging and 99% while charging.

For the captured 3890 mV value:

```text
3880 mV = 50% band start
3920 mV = 55% band start
(3920 - 3880) / 5 = 8 mV per 1%
(3890 - 3880) / 8 = 1
50 + 1 = 51%
```

This exactly reproduces the vendor application's **51%** display.

## Open panel behavior

`src/battery.js` implements the recovered calibration. `getBattery()` keeps both values:

- `percent` — calibrated value used by the official application and shown in the UI;
- `rawPercent` — raw firmware percentage byte retained for diagnostics;
- `millivolts` — battery voltage from the receiver;
- `charging` — charging flag.

Do not replace this with a fixed offset between raw and displayed percentage: the difference varies with voltage because the conversion is piecewise-interpolated.
