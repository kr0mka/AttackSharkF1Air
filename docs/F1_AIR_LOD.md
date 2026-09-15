# F1 AIR lift-off distance mapping

Verified on physical Attack Shark F1 AIR hardware identified as VID `0x3554`, PID `0xF517`, CID `124`, MID `20`.

The LOD setting is stored as the normal two-byte CompX parity/checksum pair at flash address `0x000A`.

| UI value | Raw value | Stored pair |
| --- | ---: | --- |
| 0.7 mm | 1 | `01 54` |
| 0.9 mm | 2 | `02 53` |
| 1.2 mm | 3 | `03 52` |
| 1.4 mm | 4 | `04 51` |
| 1.6 mm | 5 | `05 50` |

The second byte satisfies the project's existing `0x55` pair checksum rule, i.e. `(raw + checksum) & 0xFF == 0x55`.

These values were captured by selecting each of the five LOD choices in Control HUB WEB and reading `0x000A` back from the mouse profile flash.
