# F1 AIR physical button layout

The Attack Shark F1 AIR exposes **five physical controls** in the vendor configuration UI:

1. Left
2. Right
3. Wheel click
4. Forward
5. Backward

The profile flash nevertheless contains **six** 4-byte button records beginning at `0x0060`. The captured default profile is:

| Slot | Address | Raw | Meaning |
| --- | --- | --- | --- |
| 1 | `0x0060` | `01 01 00 53` | Left |
| 2 | `0x0064` | `01 02 00 52` | Right |
| 3 | `0x0068` | `01 04 00 50` | Wheel click |
| 4 | `0x006C` | `01 08 00 4C` | Forward |
| 5 | `0x0070` | `01 10 00 44` | Backward |
| 6 | `0x0074` | `02 01 00 52` | Internal logical slot; default action is DPI cycle |

The sixth record is preserved by the parser, backups and restore path because it is part of the device profile, but it is intentionally hidden from the normal button-mapping UI because there is no corresponding physical F1 AIR button.

The Forward/Backward action labels follow the F1 AIR vendor UI and captured default profile: `0x0800` = Forward, `0x1000` = Backward.
