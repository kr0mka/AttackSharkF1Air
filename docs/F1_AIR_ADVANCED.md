# F1 AIR advanced controls: static evidence

## Scope

The owner's supplied screenshots show Control HUB WEB 1.2.0 and Windows HUB 1.0.2.0. Neither shown UI exposes Dynamic Sensitivity. The Windows advanced page does expose mouse angle (−30° to +30°), 20K FPS scanning and long-distance mode. Both applications show three receiver LED assignments. These observations establish visible controls, not their wire encodings.

The following mappings were traced offline through the installed executable and DLL on 2026-09-19/20. The binary hashes match [RESEARCH.md](RESEARCH.md). Neither binary was loaded or executed. Addresses below are RVAs, independent of image load address. Implementation and test fixtures are original; no vendor code or artwork is redistributed.

## Mouse angle

The executable's Qt `Advanced` metadata at RVA `0x24E750` identifies `on_AngleSet_valueChanged`. Its dispatcher at `0x1B7B50` reaches the handler at `0x1A7300`. That handler passes the integer degree value to helper `0x140C00`.

The helper updates the configuration structure's byte `+0x0F` with the low byte of the degree value and sets companion byte `+0x10` to 1, then calls `ProtocolDataUpdate`. The UI refresh path at `0x1A6FBD` sign-extends byte `+0x0F` before displaying it, establishing signed 8-bit degrees rather than a 0–60 offset.

DLL parser `MouseConfigParser` maps flash `0xBD` to structure `+0x0F` and flash `0xBF` to `+0x10`. The update paths at DLL RVAs `0x88D1` and `0x891E` independently write parity pairs at `0xBD` and `0xBF`.

| Setting | Bytes |
|---|---|
| −30° | `E2 73` at `0xBD` |
| −1° | `FF 56` at `0xBD` |
| 0° | `00 55` at `0xBD` |
| +30° | `1E 37` at `0xBD` |
| Companion flag used by desktop save | `01 54` at `0xBF` |

The open panel mirrors this save behavior for −30..+30 integer degrees. It preserves all neighboring records. The companion flag is written exactly as in the desktop sequence; its independent semantics are unproven. Invalid checksums or out-of-range current values display as unknown instead of being clamped. These fields remain **candidate / Expert writes** pending a controlled hardware capture and physical direction check.

The former `0x0006` rotation hypothesis was incorrect for this desktop control. That pair is now labeled unknown and is not touched by the angle UI.

## 20K FPS scanning

Qt metadata identifies `on_KFPS_clicked`, dispatched to executable RVA `0x1A74D0`. It passes 0 or 1 to helper `0x140840`, which updates structure byte `+0x2A`. The UI read path at `0x1A7147` checks that byte against 1.

DLL parser maps flash `0xE1` to structure `+0x2A`. The writer path at DLL RVA `0x9035` builds a flash-write report; `0x90B8` sets the address to `0xE1`. The setting is the parity pair `00 55` (off) or `01 54` (on). It remains **candidate / Expert writes** pending hardware confirmation. No claim is made about power use or an interaction with the separate highest-performance timer.

The former `0x0008` 20K hypothesis was incorrect for this desktop control. That pair is now unknown and preserved.

## Receiver LEDs

DLL `UsbFinder_SetDongleIndicatorLed` at RVA `0x10220` sends three consecutive input bytes in body bytes 5–7 of opcode `0x2C`, with marker `0x0A`. Getter `0x10400` reads those three bytes from opcode `0x2D`.

The three desktop handlers at RVAs `0x43D50`, `0x43E20`, `0x43EF0` change structure byte 0, 1 or 2 respectively, retaining the others. The getter path starting at `0x3FBBD` populates three separate combo boxes. This establishes three assignments, not one mode plus two unrelated arguments.

Resource enum candidates are 0 off, 1 polling rate, 2 battery, 3 connection quality, 4 DPI level. Physical LED order and enum behavior still need per-LED captures. The open panel exposes three selectors with candidate labels, retains unknown selected bytes, re-reads all three assignments immediately before editing one, and verifies the complete read-back. Writes require Expert mode.

## Validation captures still needed

Use the Sensor preset for one official angle change (such as 0° → +1°) or one 20K toggle. For receiver assignments, export the read-only receiver endpoint probes before and after changing one LED. Keep device/profile and all other settings unchanged. Do not use the flash Lighting preset for receiver state.

Dynamic Sensitivity remains unassigned. Its resource strings and generic UI paths do not establish a working F1 AIR firmware feature, so this research does not add a speculative enable switch.
