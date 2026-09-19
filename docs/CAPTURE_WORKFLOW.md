# F1 AIR protocol capture workflow

Open **Diagnostics → Protocol capture lab** in Open Control. Captures only read flash; they never change settings or enter the bootloader.

1. Export a backup from Profiles & device before experiments.
2. Choose a setting that is actually visible in the official UI for your device, then select the matching capture preset and describe the one value transition in the notes. Shared language resources do not prove that a control is available on F1 AIR.
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

- Dynamic Sensitivity: deferred. The owner reports no such control in the current official UI. Classic/Natural/Jump/Custom are shared resource strings, not proof of F1 AIR support. Only revisit this experiment if the control is actually observed on F1 AIR; no firmware update or raw write is justified to try to expose it.
- Sensor controls: choose one visible control and capture one transition per pair. The supplied Windows screenshots establish angle and 20K scan controls. Static traces predict angle changes at `0xBD/0xBF` and 20K at `0xE1`, replacing the old `0x0006/0x0008` guesses; hardware captures are still needed. LOD can check the workflow against its already-verified mapping.
- Macro repeat: keep identical events and name; change only repeat policy. Capture **both Buttons and Macros** before and after. Export each baseline before switching presets. Do not assume repeat bits reside only in the macro slot.
- Mouse lighting: one effect/color/state change at a time using Lighting.
- Receiver lighting: use **Read receiver lighting → Export endpoint JSON** before and after one official change. This captures `0x2D` and `0x19`; receiver state does not live in the flash Lighting preset. Compare endpoint bodies separately, retaining errors as errors.
- Firmware versions: **Read version endpoints → Export endpoint JSON** in wired and wireless modes, recording the exact official displayed version in notes. Reads query `0x12`, `0x1D`, `0xB3`; unsupported endpoints may time out. These commands never flash firmware.

Only repeatable, controlled observations should promote a candidate field to verified. Preserve the raw bytes and checksum changes; do not assign semantics from a plausible-looking number alone. Synthetic tests validate software behavior, not hardware semantics.
