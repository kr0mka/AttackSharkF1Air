# F1 AIR / CompX HID protocol notes

This document describes the parts of the protocol used by **AttackSharkF1Air**. It is an interoperability note, not vendor source code. The implementation was reconstructed from observable packet/layout behavior, exported DLL entry points, data structures in the supplied F1 AIR package, and independent open-source CompX/WebHID research.

## USB identity

The supplied F1 package describes these USB identities:

- VID `0x3554`
- wired PID candidates: `0xFB43`, `0xF516`, `0xF515`
- wireless/8K PID candidates: `0xFB44`, `0xFB35`, `0xF517`
- expected CID: `124`
- F1 AIR / PAW3955 candidate MIDs: `19`, `20`, `21`, `22`

The project deliberately does not request every device using VID `0x3554` because the transport is shared by multiple CompX-based products.

## HID framing

Configuration traffic uses **report ID 8** with a **16-byte report body**.

For flash operations the body is:

| Byte | Meaning |
|---:|---|
| 0 | opcode |
| 1 | zero / flags depending on command |
| 2 | flash address high byte |
| 3 | flash address low byte |
| 4 | transfer length; bit 7 is used by some protocol variants |
| 5..14 | up to 10 payload bytes |
| 15 | checksum |

The checksum is chosen so that:

```text
(report_id + sum(body[0..15])) & 0xFF == 0x55
```

Because report ID is `0x08`, the 16-byte body's sum is `0x4D` modulo 256.

For ordinary non-flash commands, payload starts at body byte 5 and body byte 4 is the payload length. Receiver-light commands are a known exception and use marker `0x0A` in body byte 4.

## Observed opcodes

| Opcode | Purpose |
|---:|---|
| `0x01` | handshake / encryption exchange |
| `0x02` | PC driver online state |
| `0x03` | online state / USB address |
| `0x04` | battery / charging voltage |
| `0x05` | enter receiver pairing |
| `0x06` | pairing state |
| `0x07` | write flash |
| `0x08` | read flash |
| `0x09` | clear / restore settings |
| `0x0A` | status changed |
| `0x0E` | get active profile |
| `0x0F` | set active profile |
| `0x12` | normal version endpoint |
| `0xB3` | wireless slave-version endpoint; not proven to match vendor-displayed mouse firmware |
| `0x16` | set long-range mode |
| `0x17` | get long-range mode |
| `0x18` | set receiver RGB |
| `0x19` | get receiver RGB |
| `0x1D` | receiver firmware version |
| `0x2B` | RSSI |
| `0x2C` | set receiver indicator |
| `0x2D` | get receiver indicator |

The handshake response exposes CID, MID and connection/device type. Normal writes require the evidenced USB identity, CID 124 and hardware-verified MID 20. Other package MIDs remain candidates.

## Flash access

Read/write commands transfer at most 10 data bytes per HID report. The project performs writes in 10-byte chunks and then reads the complete written region back. A mismatch is treated as an error. All sends share the transaction queue; checksum-invalid/short responses cannot satisfy a request. Flash reads also match address and chunk length. Address/length inputs must be integers within the 16-bit range.

See [PROTOCOL_CAPTURE.md](PROTOCOL_CAPTURE.md) for capture schemas and compatibility checks.

Many scalar settings are stored as two bytes:

```text
[value, checksum]
```

where `(value + checksum) & 0xFF == 0x55`.

### Base settings map

The desktop DLL reads a 232-byte base-settings block (`0x0000..0x00E7`). The following fields are used by this project:

| Address | Size | Meaning |
|---:|---:|---|
| `0x0000` | 2 | polling-rate raw value + parity |
| `0x0002` | 2 | number of DPI stages |
| `0x0004` | 2 | current DPI stage |
| `0x0006` | 2 | advanced sensor-angle/rotation byte; semantics experimental |
| `0x0008` | 2 | 20K/static scan setting; semantics experimental |
| `0x000A` | 2 | LOD raw setting |
| `0x000C` | 8×4 | legacy DPI table |
| `0x002C` | 8×4 | per-stage DPI colors |
| `0x004C` | 2 | DPI-indicator effect mode |
| `0x004E` | 2 | DPI-indicator brightness |
| `0x0050` | 2 | DPI-indicator speed |
| `0x0052` | 2 | DPI-indicator state |
| `0x0060` | 6×4 | six button-action records |
| `0x00A0` | 9 | decorative light-bar record |
| `0x00A9` | 2 | debounce |
| `0x00AB` | 2 | motion sync |
| `0x00AD` | 2 | sleep time |
| `0x00AF` | 2 | angle snapping |
| `0x00B1` | 2 | ripple control |
| `0x00B3` | 2 | turn light off while moving |
| `0x00B5` | 2 | highest-performance state |
| `0x00B7` | 2 | highest-performance timer |
| `0x00B9` | 2 | sensor LP/HP mode |
| `0x00BD..0x00E7` | mixed | advanced records; structure recovered, feature associations and semantics unproven |

### Extended advanced records

The bundled parser validates the following post-`0xB9` records:

- parity pairs at `0xBD`, `0xBF`, `0xC1`, `0xD7`, `0xD9`, `0xDF`, `0xE1`, `0xE3`, `0xE5`, `0xE7`;
- four records of `4 data bytes + checksum` at `0xC3`, `0xC8`, `0xCD`, `0xD2`;
- a compact record beginning at `0xDB`.

Shared desktop language resources contain **DPI Dynamic Sensitivity** names (Classic/Natural/Jump/Custom), but do not establish a relationship to these addresses or F1 AIR support. The owner reports no such control in the current official UI. These advanced bytes remain semantically unassigned; Diagnostics labels them as unverified advanced records. Raw backups retain them, normal restore leaves current candidate/unmapped bytes untouched, and Expert restore can copy them back.

## Polling-rate values

| Hz | Raw |
|---:|---:|
| 125 | `0x08` |
| 250 | `0x04` |
| 500 | `0x02` |
| 1000 | `0x01` |
| 2000 | `0x10` |
| 4000 | `0x20` |
| 8000 | `0x40` |

## DPI storage

### PAW3955 high-resolution table

F1 AIR profiles add an eight-entry table at `0x1B00`. Each stage is six bytes:

```text
(X_DPI - 1)_LE16, (Y_DPI - 1)_LE16, flag, checksum
```

Stored `0x04AF` means 1200 DPI, `0x095F` means 2400 and `0x0ED7` means 3800. The decoder adds one; the writer subtracts one.

For the 60K profile the package uses flag `0x11`. This allows the advertised 1-DPI granularity up to 60,000 DPI.

The application updates the high-resolution record and also maintains the older 50-DPI mirror for firmware paths that still consult it.

### Legacy table

Legacy four-byte records encode a 10-bit `(DPI / 50) - 1` value plus a checksum. They are retained only as a compatibility mirror on F1 AIR.

## Button actions

Five physical mappings plus a sixth internal logical slot are stored as four-byte checksummed records. The default internal slot at `0x0074` is `02 01 00 52` (DPI cycle). F1 AIR side-button parameters are `0x0800` Forward and `0x1000` Backward.

Record layout:

```text
[action_type, parameter_high, parameter_low, checksum]
```

Important action types found in the supplied English resource include:

- `0x00` disabled
- `0x01` mouse buttons
- `0x02` DPI switching
- `0x03` horizontal scroll
- `0x04` firepower
- `0x05` shortcut/combo slot
- `0x06` macro slot
- `0x07` polling-rate switching
- `0x09` profile switching
- `0x0B` vertical scroll
- `0x10..0x16` Attack Shark special/light-control actions

The resource values `"10"` through `"16"` are hexadecimal action IDs in the underlying representation, not decimal 10–16.

The firepower UI exposes repeat count `0..3` and interval `10..255 ms`. The current project uses `(repeat << 8) | interval` as an explicitly experimental binding parameter until a one-setting F1 AIR packet capture confirms it.

## Macros and shortcuts

### Macro slot

There are 16 slots of 384 bytes beginning at `0x0300`.

Recovered layout:

- byte 0: macro name length (`1..30`)
- bytes 1..30: UTF-8 name
- byte 31: event count (up to 70 in the bundled parser)
- byte 32 onward: 5-byte events
- checksum directly after the final event

Event layout:

```text
[flags+code, data1, data2, delay_ms_be16]
```

`0x80` marks key-down, `0x40` marks key-up, and no high flag is used by mouse-command records. The low nibble carries the event code.

### Shortcut slot

There are 16 slots of 32 bytes beginning at `0x0100`. The recovered layout is a count byte followed by compact 3-byte events and a checksum.

The exact macro **repeat-policy** binding bits are still being validated. Macro event content itself round-trips in deterministic tests.

## Lighting

The DPI indicator has scalar mode/brightness/speed/state records.

The decorative light bar begins at `0x00A0`: six data bytes + checksum followed by an idle-time parity pair. The UI exposes mode, brightness, speed, RGB and idle light-off time.

Receiver indicator/RGB uses dedicated opcodes rather than profile flash.

## Pairing and power

Receiver pairing is started through opcode `0x05`; status is read through `0x06`.

The vendor UI instructs the user to hold left + right + middle for three seconds, move the mouse close to the receiver, and then start pairing.

Long-range mode uses dedicated `0x16/0x17` commands. Sleep time is an onboard profile setting.

## Firmware update boundary

The supplied DLL exports bootloader/updater functions (`EnterUsbUpdateMode`, `UsbUpgrade_*`) and the vendor package includes firmware images, but the complete bootloader transfer/rollback behavior has not yet been proven. The open panel therefore reports firmware versions and can inspect a selected `.bin`, but does **not** send firmware payloads. This is intentional to avoid turning an incomplete reverse-engineering guess into a bricking path.
