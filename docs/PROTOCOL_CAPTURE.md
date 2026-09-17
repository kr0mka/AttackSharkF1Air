# F1 AIR protocol capture workflow

The open panel should not guess when a vendor setting can be captured.

## Capture process

1. Export a backup from the panel.
2. Capture a baseline region.
3. Change exactly one setting in the official Control HUB.
4. Capture the same region again.
5. Diff the two captures.
6. Promote only stable changes into the protocol registry.

## Confidence levels

- verified: directly observed on F1 AIR hardware with before/after captures.
- likely: supported by vendor DLL behavior and stable layout.
- candidate: address known but semantic meaning not proven.

## Recommended first captures

### Sensor

Capture base settings before/after:

- LP/HP sensor mode
- motion sync
- ripple
- angle snapping
- highest performance
- 20K FPS scan
- dynamic sensitivity presets

### Lighting

Capture:

- DPI indicator modes
- light bar effects
- receiver LED assignments
- RGB colors

### Macros

Create one macro for each repeat mode:

- once
- repeat until release
- repeat until any key
- toggle repeat
- fixed count

Compare both macro bytes and the button assignment record.

## Firmware endpoints

Always record raw responses from:

- `0x12`
- `0x1D`
- `0xB3`

because wireless F1 AIR firmware reporting has multiple endpoint paths.
