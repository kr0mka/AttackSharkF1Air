# Feature-parity matrix

| Vendor control | Open panel status | Notes |
|---|---|---|
| Device connect / status | Implemented | WebHID, F1 identity gate |
| Battery / charging voltage | Implemented | live device command |
| Version endpoints | Read-only | exports 0x12 / 0x1D / 0xB3; vendor v5.23 vs 0xB3 v5.02 unresolved |
| DPI stage count / active stage | Implemented | 1–8 stages |
| DPI 1–60,000 / 1-step | Implemented | PAW3955 high-resolution table |
| DPI stage colors | Implemented | onboard records |
| Polling 125–8000 Hz | Implemented | wired/wireless device dependent |
| Debounce | Implemented | onboard scalar |
| LP / HP sensor mode | Implemented | corded-auto is not written as an invented byte |
| LOD | Verified | raw 1–5 = 0.7 / 0.9 / 1.2 / 1.4 / 1.6 mm |
| Highest performance + timer | Implemented | onboard settings |
| Ripple control | Implemented | onboard setting |
| Angle snap | Implemented | onboard setting |
| Motion sync | Implemented | onboard setting |
| 20K FPS scan | Experimental | desktop + DLL trace establishes 0xE1 off/on = 0/1; hardware confirmation pending |
| Mouse rotation / angle mode | Experimental | −30..+30 signed degrees at 0xBD + enable at 0xBF; static trace, hardware confirmation pending |
| Dynamic Sensitivity presets/custom curve | Availability unconfirmed | shared resources only; owner reports no control in current official UI; advanced bytes remain semantically unassigned |
| Five physical button remaps | Implemented | sixth logical firmware slot preserved, hidden from physical UI |
| DPI/polling/profile/light actions | Implemented | vendor action IDs |
| Firepower | Experimental | UI limits known; binding parameter still needs a capture |
| Combo / shortcut slots | Implemented | 16 onboard slots |
| Multimedia actions | Implemented | through consumer-control shortcut records |
| Macro slots | Implemented | 16 × 384 B, recorder/editor |
| Macro repeat policies | Partial | event content works; repeat-policy binding bits not guessed |
| DPI indicator effects | Implemented | mode/brightness/speed/state |
| Decorative light bar | Implemented | effect/brightness/speed/RGB/idle behavior |
| Receiver indicator | Three LED selectors | preserves unknown assignments; fresh read and complete read-back; candidate enum labels, Expert writes |
| Receiver RGB | Protocol implemented | lower-level API available; UI can be extended once exact F1 semantics are confirmed |
| Sleep time | Implemented | onboard setting |
| Long-distance mode | Implemented | dedicated command |
| Receiver pairing | Implemented | start + status |
| Four onboard profiles | Implemented | dedicated profile command |
| Export/import | Implemented | exact region and identity/profile validation; unknown bytes preserved, raw restore requires Expert writes |
| Restore defaults | Implemented | vendor clear-setting command |
| Diagnostics capture/diff / live log | Implemented | seven presets, raw bytes, absolute addresses, confidence, JSON export/import, offline comparison |
| Firmware update | Intentionally disabled | version/`.bin` inspection only until bootloader protocol is verified |
