# F1 AIR protocol capture workflow

Use before/after captures when a vendor Control HUB option is not yet mapped.

## Procedure

1. Export a backup from Open Control.
2. Read the relevant region before changing anything.
3. Change exactly one setting in the official application.
4. Read the same region again.
5. Compare the two captures.

Do not combine multiple settings in one capture; otherwise the changed byte ownership cannot be determined.

Recommended first captures:

- Sensor: LP/HP, ripple, angle snapping, motion sync, 20K FPS.
- Lighting: receiver LED assignments, DPI effects, light bar modes.
- Macros: each repeat mode with identical key events.
- Firmware: compare wired and wireless version endpoints.

A good capture should identify:

- flash address;
- changed bytes;
- checksum/parity behavior;
- UI meaning.
