# AttackSharkF1Air — F1 AIR Open Control

An open-source, dependency-free WebHID control panel for the **Attack Shark F1 AIR** mouse family. The project is a clean-room interoperability implementation derived from observable device behavior, the public Control HUB WEB feature surface, and protocol structures recovered from the user's legally supplied driver package.

It does **not** ship Attack Shark executables, DLLs, firmware images, artwork, or other vendor assets, and it does not require the vendor driver at runtime.

## Current status

The application implements the F1 AIR / PAW3955 control surface with:

- device discovery and CID/MID safety identification;
- battery, charging voltage, connection type, mouse firmware and receiver firmware;
- exact 1–60,000 DPI stages via the PAW3955 high-resolution table plus a legacy compatibility mirror;
- 125 / 250 / 500 / 1000 / 2000 / 4000 / 8000 Hz polling;
- debounce, sensor LP/HP mode, motion sync, angle snapping, ripple control, highest-performance mode and timers;
- raw LOD access (see the LOD caveat below);
- six onboard button mappings, DPI/report/profile switching, scroll actions and Attack Shark light-control actions;
- 16 shortcut/combo slots and 16 macro slots, with a keyboard recorder and manual event editor;
- DPI indicator effects, per-stage colors and decorative light-bar controls;
- receiver indicator read/write, RSSI diagnostics and long-distance mode;
- four onboard profiles, sleep time, receiver pairing and factory reset;
- complete JSON backup/restore of base settings, PAW3955 high-resolution DPI data, shortcuts and macros;
- raw flash reader and packet log for continued protocol validation.

### Intentionally interlocked / still being validated

Two settings are exposed without pretending their F1-specific encoding is proven:

1. **Five-level F1 AIR LOD mapping.** The bundled desktop resources prove an older raw mapping (`3 → 0.7 mm`, `1 → 1 mm`, `2 → 2 mm`), while current F1 AIR material advertises five levels (`0.7 / 0.9 / 1.2 / 1.4 / 1.6 mm`). The UI therefore exposes the raw LOD byte instead of inventing a new mapping. A one-minute before/after capture from real F1 AIR hardware will resolve this.
2. **Macro repeat policy.** Macro names/events are fully encoded and decoded, but “repeat until release / until another button / N times” appears to live with the button-to-macro binding rather than in the recovered 384-byte event record. Until a known-good F1 AIR capture confirms those parameter bits, the app preserves macro content without fabricating the repeat flags.

**Firmware flashing is not enabled.** The package includes receiver firmware and bootloader entry routines, but pushing an incompletely understood updater protocol would be an avoidable bricking risk. Firmware files can be inspected only.

## Run it

WebHID currently requires a Chromium-family browser. Firefox does not expose `navigator.hid` natively.

```bash
python -m http.server 8080
```

Then open `http://localhost:8080` in Chrome, Edge, Chromium or Brave and click **Connect mouse**.

No `npm install` is required. `package.json` exists only for the protocol tests / syntax checks:

```bash
npm test
npm run check
```

### GitHub Pages

A Pages workflow is included in `.github/workflows/pages.yml`. After placing the files in the repository, enable **Settings → Pages → Source: GitHub Actions** once; pushes to `main` or `master` then deploy the panel over HTTPS, which satisfies WebHID's secure-context requirement.

## Safety model

The app is intentionally conservative:

- requests only Attack Shark/CompX VID `0x3554` plus PIDs evidenced by the supplied F1 package;
- performs the protocol handshake before enabling writes;
- automatically enables writes only for **CID 124** and the supplied F1 AIR candidate MIDs **19–22**;
- provides a session-only **Expert writes** override for reverse-engineering other compatible units;
- reads settings before presenting them;
- writes checksummed/parity-protected records and performs read-back verification;
- backup/restore validates the backup schema and CID;
- does not expose an unverified firmware flasher.

## Known USB / F1 profile evidence

From the supplied configuration:

- VID: `0x3554`
- wired PID candidates: `0xFB43`, `0xF516`, `0xF515`
- wireless/8K receiver PID candidates: `0xFB44`, `0xFB35`, `0xF517`
- CID: `124`
- PAW3955 / 60K-DPI MIDs in the package: `19`, `20`, `21`, `22`
- key count: `6`

Do not broaden the WebHID filter to every `0x3554` device unless you understand the profile differences: many brands share this CompX transport.

## Architecture

- `src/protocol.js` — report framing, checksums, HID transport, flash read/write and device commands.
- `src/codecs.js` — parity records, 50-DPI legacy records, exact PAW3955 60K records, button/light/macro/shortcut codecs.
- `src/device-model.js` — safe model-level reads/writes, parsing, backups and identity gate.
- `src/app.js` — dependency-free UI and actions.
- `docs/PROTOCOL.md` — reverse-engineered protocol notes.
- `docs/RESEARCH.md` — evidence and uncertainty ledger.
- `docs/FEATURE_MATRIX.md` — vendor/open-panel parity table and remaining capture-dependent items.
- `tools/webhid-sniffer.js` — small inbound-report logger helper.
- `tests/` — deterministic codec/protocol tests that require no mouse.

## Contributing useful captures

The Diagnostics tab is designed for finishing the last F1-specific unknowns. The most useful captures are:

- base dump **before and after changing only one LOD level** in the official software;
- button record before/after binding one known macro with each repeat policy;
- base dump before/after changing Dynamic Sensitivity / sensor rotation if those controls appear for your firmware.

Please avoid committing the proprietary `HIDUsb.dll`, official executables or firmware binaries to this repository. Commit only short, factual protocol observations or your own captures.

## License

MIT. See `LICENSE`.
