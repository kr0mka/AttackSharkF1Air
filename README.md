# AttackSharkF1Air — F1 AIR Open Control

An open-source, dependency-free WebHID control panel for the **Attack Shark F1 AIR** mouse family. The project is a clean-room interoperability implementation derived from observable device behavior, the public Control HUB WEB feature surface, and protocol structures recovered from the user's legally supplied driver package.

It does **not** ship Attack Shark executables, DLLs, firmware images, artwork, or other vendor assets, and it does not require the vendor driver at runtime.

## Current status

The application implements the F1 AIR / PAW3955 control surface with:

- device discovery and CID/MID safety identification;
- calibrated battery, raw battery diagnostics, charging voltage, connection type and raw version endpoints;
- exact 1–60,000 DPI stages via the PAW3955 high-resolution table plus a legacy compatibility mirror;
- 125 / 250 / 500 / 1000 / 2000 / 4000 / 8000 Hz polling;
- debounce, sensor LP/HP mode, motion sync, angle snapping, ripple control, highest-performance mode and timers;
- verified five-level LOD: 0.7 / 0.9 / 1.2 / 1.4 / 1.6 mm;
- five physical button mappings, with the sixth internal logical record preserved, DPI/report/profile switching, scroll actions and Attack Shark light-control actions;
- 16 shortcut/combo slots and 16 macro slots, with a keyboard recorder and manual event editor;
- DPI indicator effects, per-stage colors and decorative light-bar controls;
- receiver indicator read/write, RSSI diagnostics and long-distance mode;
- four onboard profiles, sleep time, receiver pairing and factory reset;
- complete JSON backup/restore of base settings, PAW3955 high-resolution DPI data, shortcuts and macros;
- integrated Diagnostics capture lab with seven presets, baseline/after comparison, confidence labels, JSON import/export and live HID logging;
- read-only version and receiver-light endpoint exports.

### Intentionally interlocked / still being validated

Verified LOD and side-button mappings are documented in [F1_AIR_LOD.md](docs/F1_AIR_LOD.md) and [F1_AIR_BUTTONS.md](docs/F1_AIR_BUTTONS.md).

Dynamic Sensitivity appears in shared vendor resources, but F1 AIR availability is unconfirmed and the owner does not see it in the current official UI. It is not a required capture or an established F1 AIR feature. Rotation, 20K scanning values, lighting assignment semantics and macro repeat bindings still need controlled captures for controls actually exposed by the device. Candidate scalar fields, unknown button parameters and receiver indicator writes require **Expert writes**. Resource enum values alone do not establish their packet encoding.

The wireless `0xB3` endpoint returned v5.02 while the official app displayed v5.23. Diagnostics exports raw `0x12`, `0x1D` and `0xB3` replies; the app does not equate `0xB3` with the official mouse firmware display.

**Firmware flashing is not enabled.** The package includes receiver firmware and bootloader entry routines, but pushing an incompletely understood updater protocol would be an avoidable bricking risk. Firmware files can be inspected only.

## Run it

WebHID currently requires a Chromium-family browser. Firefox does not expose `navigator.hid` natively.

```bash
python -m http.server 8080
```

Then open `http://localhost:8080` in Chrome, Edge, Chromium or Brave and click **Connect mouse**.

No `npm install` is required for runtime or unit tests. Optional browser QA uses Playwright with a simulated HID device (`npm install --no-save --package-lock=false playwright`, then `node tools/browser-smoke.mjs`; on Linux first run `npx playwright install chromium`). No real HID device is accessed by that test.

Development checks:

```bash
npm test
npm run check
```

### GitHub Pages

A Pages workflow is included in `.github/workflows/pages.yml`. After placing the files in the repository, enable **Settings → Pages → Source: GitHub Actions** once; pushes to `main` or `master` run checks and deploy the `npm run build` runtime artifact in `dist/` over HTTPS. CI also runs the browser smoke test against that artifact.

## Safety model

The app is intentionally conservative:

- requests only Attack Shark/CompX VID `0x3554` plus PIDs evidenced by the supplied F1 package;
- performs the protocol handshake before enabling writes;
- automatically enables writes only for **VID 0x3554, an evidenced PID, CID 124 and hardware-verified MID 20**;
- provides a session-only **Expert writes** override for reverse-engineering candidate fields and other compatible units;
- reads settings before presenting them;
- writes checksummed/parity-protected records and performs read-back verification;
- backup/restore validates every region address and exact length, VID/PID/CID/MID and active profile before writing;
- normal restore preserves current candidate/unmapped bytes; Expert restore also copies those bytes from the raw backup;
- all eight DPI records and the sixth logical button record are retained in backups/restores;
- does not expose an unverified firmware flasher.

## Known USB / F1 profile evidence

From the supplied configuration:

- VID: `0x3554`
- wired PID candidates: `0xFB43`, `0xF516`, `0xF515`
- wireless/8K receiver PID candidates: `0xFB44`, `0xFB35`, `0xF517`
- CID: `124`
- PAW3955 candidate MIDs in the package: `19`, `20`, `21`, `22`; MID 20 is hardware-verified (MID 21 has a different advertised DPI ceiling)
- five physical controls; six stored button records (slot 6 is internal)

Do not broaden the WebHID filter to every `0x3554` device unless you understand the profile differences: many brands share this CompX transport.

## Architecture

- `src/protocol.js` — report framing, checksums, HID transport, flash read/write and device commands.
- `src/codecs.js` — parity records, 50-DPI legacy records, exact PAW3955 60K records, button/light/macro/shortcut codecs.
- `src/device-model.js` — safe model-level reads/writes, parsing, backups and identity gate.
- `src/app.js` — dependency-free UI and actions.
- `src/ui/` — capture lab and direct F1 LOD/physical-button rendering.
- `src/capture.js` / `src/protocol-map.js` — capture schemas, comparison, region presets and evidence labels.
- `src/protocol/` — flash bounds, backup validation, conservative restore spans and read-only endpoint capture.
- `docs/PROTOCOL.md` — reverse-engineered protocol notes.
- `docs/RESEARCH.md` — evidence and uncertainty ledger.
- `docs/FEATURE_MATRIX.md` — vendor/open-panel parity table and remaining capture-dependent items.
- `tools/webhid-sniffer.js` — small inbound-report logger helper.
- `tests/` — deterministic codec/protocol tests that require no mouse.

## Contributing useful captures

Use the [capture workflow](docs/CAPTURE_WORKFLOW.md). Diagnostics works disconnected for importing/comparing captures. Snapshots stay in memory across disconnects and tab changes; export before reloading or closing the page. It is designed for finishing the remaining F1-specific unknowns. The most useful captures are:

- Sensor preset before/after changing one control that is actually visible in the official UI, such as motion sync, ripple or angle snapping;
- button record before/after binding one known macro with each repeat policy;
- optional captures of additional controls only after confirming they appear for your device and firmware. Do not search for or try to unlock Dynamic Sensitivity based on shared resource strings.

Please avoid committing the proprietary `HIDUsb.dll`, official executables or firmware binaries to this repository. Commit only short, factual protocol observations or your own captures.

## License

MIT. See `LICENSE`.
