# F1 AIR protocol capture workflow

Open **Diagnostics → Protocol capture lab** in Open Control. Captures only read flash; they never change settings or enter the bootloader.

1. Export a backup from Profiles & device before experiments.
2. Select a preset and describe the one official setting/value transition in the notes.
3. Click **Capture baseline**, then **Export JSON**. Export before reloading/closing the page or changing presets; snapshots are otherwise held only in memory. Disconnecting retains them.
4. Disconnect Open Control. In official Control HUB, change exactly one setting, keeping the same device and onboard profile. Close/disconnect Control HUB to release HID ownership.
5. Reconnect Open Control. Import the baseline if the page was reloaded. Select the same device and active profile. Click **Capture after**.
6. Click **Compare**. The table shows absolute address, before/after byte, protocol field and confidence. Zero changed bytes is a valid result. Large results are paginated; JSON always includes the complete diff.
7. **Export JSON** saves both snapshots plus the normalized diff and notes. Importing a comparison recomputes its diff and current protocol labels.

Diagnostics also works disconnected for import, comparison and export. Changing the preset clears the current pair. A failed after-capture does not replace the last successful snapshot. Unsupported older v1 captures lack identity/profile/range metadata and cannot be safely compared in the UI.

## Presets

| Preset | Start | Bytes | Coverage |
|---|---:|---:|---|
| Base | 0x0000 | 232 | Entire base block, including unknown bytes |
| Sensor | 0x0000 | 232 | Same base block; includes advanced candidate range |
| Buttons | 0x0060 | 24 | Five physical records and internal sixth slot |
| Lighting | 0x002C | 137 | Colors, DPI effects, light bar, moving-light-off; intervening bytes retained |
| High-DPI | 0x1B00 | 48 | All eight firmware DPI records, including unused records |
| Shortcuts | 0x0100 | 512 | All 16 shortcut slots |
| Macros | 0x0300 | 6144 | All 16 macro slots |

Keep settings stable while a read runs. Each snapshot queries fresh identity, online state and active profile, then checks the profile again after reading. A disconnect, short read or changed profile rejects the capture. Sequential chunks are not an atomic device snapshot; another application changing settings during capture could still mix data. The app prevents overlapping local operations, but cannot lock out the official application.

Comparison refuses differing device identities, profiles, region sets or ranges. USB identity metadata has no unique physical serial in this implementation, so two units of the same model may be indistinguishable: use the same physical mouse/receiver.

## Experiments still needed

- Dynamic Sensitivity: Sensor baseline, then Classic → Natural → Jump → Custom in separate pairs. For Custom, change only one point/axis per capture. Record official input/output values. Resource option IDs do not prove flash encoding.
- Sensor controls: one LP/HP, motion-sync, ripple, angle-snap, performance or 20K-scan transition per pair.
- Macro repeat: keep identical events and name; change only repeat policy. Capture **both Buttons and Macros** before and after. Export each baseline before switching presets. Do not assume repeat bits reside only in the macro slot.
- Mouse lighting: one effect/color/state change at a time using Lighting.
- Receiver lighting: use **Read receiver lighting → Export endpoint JSON** before and after one official change. This captures `0x2D` and `0x19`; receiver state does not live in the flash Lighting preset. Compare endpoint bodies separately, retaining errors as errors.
- Firmware versions: **Read version endpoints → Export endpoint JSON** in wired and wireless modes, recording the exact official displayed version in notes. Reads query `0x12`, `0x1D`, `0xB3`; unsupported endpoints may time out. These commands never flash firmware.

Only repeatable, controlled observations should promote a candidate field to verified. Preserve the raw bytes and checksum changes; do not assign semantics from a plausible-looking number alone. Synthetic tests validate software behavior, not hardware semantics.
