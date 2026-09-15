# Feature-parity matrix

| Vendor control | Open panel status | Notes |
|---|---|---|
| Device connect / status | Implemented | WebHID, F1 identity gate |
| Battery / charging voltage | Implemented | live device command |
| Mouse / receiver firmware version | Implemented | read-only |
| DPI stage count / active stage | Implemented | 1–8 stages |
| DPI 1–60,000 / 1-step | Implemented | PAW3955 high-resolution table |
| DPI stage colors | Implemented | onboard records |
| Polling 125–8000 Hz | Implemented | wired/wireless device dependent |
| Debounce | Implemented | onboard scalar |
| LP / HP sensor mode | Implemented | corded-auto is not written as an invented byte |
| LOD | Partial | raw byte editable; five F1 physical-level values need capture mapping |
| Highest performance + timer | Implemented | onboard settings |
| Ripple control | Implemented | onboard setting |
| Angle snap | Implemented | onboard setting |
| Motion sync | Implemented | onboard setting |
| 20K FPS scan | Experimental | address/layout recovered; semantic values need hardware confirmation |
| Mouse rotation / angle mode | Experimental | raw byte path available; physical-angle mapping not yet proven |
| Dynamic Sensitivity presets/custom curve | Preserved / diagnostic | record structures recovered; semantic byte mapping not guessed |
| Six button remaps | Implemented | standard + Attack Shark special actions |
| DPI/polling/profile/light actions | Implemented | vendor action IDs |
| Firepower | Experimental | UI limits known; binding parameter still needs a capture |
| Combo / shortcut slots | Implemented | 16 onboard slots |
| Multimedia actions | Implemented | through consumer-control shortcut records |
| Macro slots | Implemented | 16 × 384 B, recorder/editor |
| Macro repeat policies | Partial | event content works; repeat-policy binding bits not guessed |
| DPI indicator effects | Implemented | mode/brightness/speed/state |
| Decorative light bar | Implemented | effect/brightness/speed/RGB/idle behavior |
| Receiver indicator | Implemented | dedicated receiver command + raw args |
| Receiver RGB | Protocol implemented | lower-level API available; UI can be extended once exact F1 semantics are confirmed |
| Sleep time | Implemented | onboard setting |
| Long-distance mode | Implemented | dedicated command |
| Receiver pairing | Implemented | start + status |
| Four onboard profiles | Implemented | dedicated profile command |
| Export/import | Implemented | complete known-region JSON backup with CID check |
| Restore defaults | Implemented | vendor clear-setting command |
| Raw diagnostics / packet log | Implemented | read-only expert tools |
| Firmware update | Intentionally disabled | version/`.bin` inspection only until bootloader protocol is verified |
