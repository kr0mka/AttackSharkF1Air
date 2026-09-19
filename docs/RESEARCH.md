# Research / evidence ledger

This project is a clean-room interoperability implementation. No Attack Shark executable, DLL, firmware image, UI artwork, or vendor source code is included in the repository.

## September 2026 screenshot and static-trace corrections

See [F1_AIR_ADVANCED.md](F1_AIR_ADVANCED.md) for the complete executable-handler → configuration-structure → DLL-flash-writer evidence chain. It corrects the angle address to `0xBD/0xBF`, identifies 20K scan at `0xE1`, and establishes three receiver assignment bytes. These semantics remain candidates pending controlled hardware captures. The supplied web 1.2.0 and desktop 1.0.2.0 screenshots do not show Dynamic Sensitivity. Current screenshots show three configured DPI stages and a physical side button assigned DPI cycle; neither contradicts the earlier six-stage capture or proves a sixth physical button.

The same static pass found a macro-checksum bug: DLL `MacroKeyToBuffer` RVA `0xA740` calls the checksum helper with start `31` and exclusive end `32 + 5*n` at `0xA7EC..0xA7FC`. `BufferToMacroKey` at `0xA820` validates the same range (`0xA883..0xA8A1`). Helper `0x10E30` sums the selected range and returns `0x55 - sum` at `0x10F26..0x10F2E`. Names/header padding are excluded. The parser accepts 2–70 macro events; shortcut encoder/parser `0xA560/0xA640` accepts 2–6. Independent synthetic wire fixtures now cover the corrected range and count boundaries; no live macro execution was performed.

## Supplied package inspected

The user supplied `ATTACK SHARK MOUSE HUB.zip`. Relevant artifacts included:

- `ATTACK  SHARK MOUSE HUB.exe`
- `HIDUsb.dll` / `HIDUsb.lib`
- `Language/*.json`
- `usersetting/Config.ini` and related profiles
- sensor capability header/resources
- mouse and receiver firmware `.bin` images

Reference SHA-256 hashes for the two binaries inspected during research:

```text
HIDUsb.dll
6ce1feaad5b0edda3a01a906458fc30e93e1563ba708f31eda3192de347cbd79

ATTACK  SHARK MOUSE HUB.exe
51dd40890b87a2c951e9a947a040c74334edb6b6be56e1a13895ccd3dc41e3fb
```

These hashes exist only to make future research reproducible; the binaries themselves are deliberately excluded.

## Strong evidence recovered from the package

### Identity/profile data

`Config.ini` decodes to:

- VID `3554`
- wired PIDs `FB43`, `F516`, `F515`
- wireless/8K PIDs `FB44`, `FB35`, `F517`
- CID `124`
- 18 profile variants
- F1-era PAW3955 entries with MIDs `19..22`
- six stored button records; only five are physical F1 AIR controls

The PAW3955 profile data advertises a 60K DPI range and high-resolution flag `0x11`.

### Sensor capability header

The supplied sensor capability table marks PAW3955 as supporting:

- sensor mode selection;
- LOD;
- ripple control;
- angle/fix-line control;
- motion sync.

It does not list mouse-pad calibration for PAW3955.

### UI resources

The English language resource establishes the vendor feature surface and many raw values, including:

- 125/250/500/1000/2000/4000/8000 Hz polling;
- sensor mode LP / HP / corded-auto wording;
- LOD and highest-performance mode;
- ripple, angle snap, motion sync;
- 20K FPS static scanning;
- mouse-angle mode;
- shared Dynamic Sensitivity labels Classic / Natural / Jump / Custom; their presence does not establish F1 AIR availability;
- sleep and long-distance mode;
- receiver pairing instructions;
- DPI/decorative lighting labels;
- firepower repeat/interval limits;
- button action IDs.

### DLL exports and parser behavior

The DLL exposes read/write operations for settings, battery, current DPI, versions, RSSI, receiver indicators/RGB, pairing and long-range mode. Static disassembly of its parsers gave the 232-byte base-settings map, exact high-resolution DPI record, macro/shortcut layout and additional advanced records.

## Public web app / current product cross-check

The public Attack Shark Control HUB was inspected at:

- <https://controlhub.top/AttackShark/>

The same Control HUB platform is publicly indexed for other brands and shows the common feature surface: DPI stages, up to 8K polling, sensor mode/LOD/performance, ripple/angle/motion sync, macros, lighting, pairing, sleep and long-range mode.

Current F1 AIR product material was cross-checked at:

- <https://attackshark.com/products/attack-shark-f1-air-39g-wireless-paw3955max-gaming-mouse>

It documents PAW3955MAX, 1–60,000 DPI in 1-DPI increments, dual 8000 Hz, 20K FPS static scan and five LOD levels (0.7/0.9/1.2/1.4/1.6 mm).

Independent open-source CompX/WebHID research was used only as a protocol sanity check, especially for report framing/checksums. F1 AIR-specific values in this repository are taken from the supplied F1 package wherever the two differ.

## First real F1 AIR hardware capture

A live F1 AIR connected through the 8K receiver identified itself as:

- PID `0xF517`; CID `124`; MID `20`; device type `5` (Wireless 8K);
- receiver firmware `5.02`;
- six enabled DPI stages with current stage index `2`;
- base report-rate record `04 51` (250 Hz);
- current LOD record `01 54` (raw value `1`).

The high-resolution table at `0x1B00` established an important F1-specific detail: the 16-bit PAW3955 value is stored as **DPI - 1**. For example, stage 3 returned `D7 0E` (`0x0ED7 = 3799`) while the configured value is 3800 DPI. Other captures line up the same way (`AF 04` = 1199 -> 1200, `5F 09` = 2399 -> 2400, etc.). The writer therefore subtracts one and the decoder adds one.

The same session showed that sending battery/version/profile/range requests concurrently causes the receiver to answer only a subset of them. The vendor DLL serializes exchanges; the open transport now does the same so only one request/response transaction is outstanding at a time. The wireless slave-version endpoint is queried with `0xB3`, while receiver firmware remains `0x1D`. The official mouse firmware display can differ from `0xB3` and remains unresolved.

The current official web UI was also captured exposing the five F1 AIR LOD choices: **0.7, 0.9, 1.2, 1.4 and 1.6 mm**. Subsequent controlled captures verified raw 1–5 in that order; see [F1_AIR_LOD.md](F1_AIR_LOD.md).

## Confidence ledger

| Area | Confidence | Treatment |
|---|---|---|
| HID report framing/checksum | high | normal UI |
| flash read/write + read-back | high | normal UI |
| F1 CID/MID identity gate | MID 20 verified; other MIDs candidates | normal writes limited to MID 20 |
| polling rate | high | normal UI |
| PAW3955 exact DPI table | high | normal UI |
| button record format | high | normal UI |
| macro event storage | high | normal UI |
| shortcut storage | medium-high | normal UI, raw JSON available |
| debounce/motion/angle/ripple/sleep/performance/sensor mode | high | normal UI |
| light-bar record structure | medium-high | normal UI |
| receiver indicator commands | structure known; semantics candidate | read-only capture; Expert writes |
| 5-level F1 LOD raw mapping | verified | five physical levels |
| signed mouse angle at `0xBD`, companion flag at `0xBF` | static desktop + DLL trace; hardware pending | Expert writes |
| 20K scan at `0xE1`, off/on = 0/1 | static desktop + DLL trace; hardware pending | Expert writes |
| scalars at `0x0006` and `0x0008` | unknown; former angle/20K hypotheses rejected | preserve |
| Dynamic Sensitivity availability and byte meanings | unconfirmed; absent in owner-reported UI | defer experiment; preserve advanced raw records without assigning this feature |
| firepower parameter bits | medium-low | explicitly experimental |
| macro repeat-policy binding bits | unresolved | not guessed |
| firmware bootloader transfer | unresolved | flashing disabled |

## What would close the remaining gaps fastest

A real F1 AIR connected to the official driver can resolve the remaining user-facing semantics with **single-change captures**:

1. use Sensor captures to verify each processing control independently (LP/HP, motion sync, ripple, angle snapping, 20K scan);
2. bind one known macro using each repeat policy and compare only its four-byte button record;
3. only if Dynamic Sensitivity is actually exposed on F1 AIR, compare individual mode changes across the full base block; no particular address is established;
4. only after confirming such a control exists, change one custom curve point per capture; currently deferred because the owner reports no Dynamic Sensitivity control;
5. change mouse rotation by a few known angles and compare `0xBD/0xBF` while retaining the entire base block.

The project's Diagnostics tab and `tools/webhid-sniffer.js` exist specifically for these captures.


## Installed-reference recheck (2026-09-19)

Read-only inspection of `C:\Program Files (x86)\ATTACK SHARK MOUSE HUB` confirmed both EXE/DLL SHA-256 hashes above. Neither binary was run or loaded.

`Language/en.json` contains Dynamic Sensitivity UI option IDs Custom=0, Classic=1, Natural=2, Jump=3. These are resource IDs, **not established flash values**. No address, scaling, mode bits or curve coefficients have been promoted from them.

The resource has two different receiver indication lists: one includes off/polling/battery/connection-quality/DPI; another describes polling/battery/low-battery-warning. In particular, value 3 has different descriptions across lists. The applicable list, fields and receiver RGB relationship need controlled `0x2D`/`0x19` captures; no new semantic enum is inferred.

`Config.ini` MID 20 advertises six enabled stages and six stored key records. Its raw defaults are not a replacement for the hardware-captured physical-button map. MID 21 advertises a 52,000 upper DPI limit in the installed package, so package membership alone is insufficient to grant the MID 20 write policy.

Current remaining evidence gate: collect one-setting F1 AIR captures. Browser fixtures are synthetic regression data and do not prove Dynamic Sensitivity, lighting, repeat policy or firmware semantics. Firmware flashing remains disabled.


### Owner correction: feature availability

The owner reports that Dynamic Sensitivity is not visible anywhere in their current official UI. The earlier Classic → Natural capture recommendation incorrectly promoted a shared resource label into an expected F1 AIR control. Availability remains unconfirmed; this is not evidence of a hidden feature, a required firmware update, or a known mapping at `0xBD..0xE7`.

The installed MID 20 profile contains an `Adveanced=0,2` entry, but its numeric meanings are not established here. The PAW3955 capability header lists sensor-mode selection, LOD, ripple, angle/fix-line and motion sync; it does not establish Dynamic Sensitivity support. Capture work should use controls actually visible on the device, with the advanced bytes retained for future evidence.
