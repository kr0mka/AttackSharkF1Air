# Protocol capture formats and validation

See [CAPTURE_WORKFLOW.md](CAPTURE_WORKFLOW.md) for the Diagnostics procedure and presets.

## Snapshot: `attackshark-f1-air-capture/v2`

- `createdAt`, `completedAt`: ISO timestamps bounding the read.
- `label`, `notes`, `preset`: experiment context.
- `identity`: VID, PID, product name, CID, MID and device type, freshly read for the capture.
- `activeProfile`: zero-based onboard profile, read before/after the operation.
- `regions`: objects keyed by region name; each holds `label`, integer `address`, exact `length`, and an ordinary array of integer `bytes` (0–255).

Byte arrays are raw, including unknown/hidden data and record checksums. Regions must fit the 16-bit flash range without overlap. A short read is not padded into a valid snapshot.

## Comparison: `attackshark-f1-air-comparison/v1`

Includes `createdAt`, experiment `notes`, the complete `before` and `after` v2 snapshots, and `diff` sorted by absolute address. Each change contains:

```json
{
  "region": "sensor",
  "offset": 10,
  "address": 10,
  "before": 1,
  "after": 2,
  "field": "Lift-off distance",
  "confidence": "verified"
}
```

The example illustrates representation only. Checksum-byte changes are separate rows. Equal bytes are omitted. Empty `diff` means the selected region did not change. Missing regions, unequal lengths, changed identities or different profiles are rejected rather than treated as byte changes. Imported diffs/labels are recomputed from raw snapshots using the current protocol registry.

The foundation's v1 byte-only helpers remain available for historical tooling, but v1 captures cannot be imported as comparable v2 evidence without the missing metadata. JSON imports are limited to 2 MB. The UI accepts the seven supported preset ranges; the pure comparison API also supports multiple explicitly addressed, nonoverlapping regions.

## Endpoint capture: `attackshark-f1-air-endpoints/v1`

Includes timestamps, identity, active profile, notes, group, `reportId: 8`, and `responses`. Each response records the opcode, endpoint label, status and exact 16-byte body, or `body: null` plus an error. Errors are not represented as zero-filled successful responses. Endpoint exports are distinct from flash comparison files; use their raw responses for wired/wireless and receiver-light investigations.

Version group: `0x12`, `0x1D`, `0xB3`. Receiver group: `0x2D`, `0x19`. These fixed allowlists cannot accept bootloader/set/write commands. The wireless slave-version response is not automatically the firmware number shown by Control HUB.

## Confidence and writes

- **verified**: observed on F1 AIR hardware.
- **likely**: supported structurally by the installed package/parser; semantics still deserve controlled verification.
- **candidate**: proposed field association; exact meaning unproven.
- **unknown**: unmapped bytes.

`src/protocol-map.js` is the address registry. New discoveries require a factual evidence note and regression test before promotion. Capture comparisons never alter confidence automatically.

Candidate/unmapped scalar fields and unverified button/receiver parameters require Expert writes. Normal backup restore writes only verified/likely spans, keeping current unknown/candidate bytes untouched. Expert restore copies every byte of the validated backup regions. Both paths preserve the sixth stored logical button record and all eight DPI records; neither follows arbitrary file-supplied addresses.

## Validation

`npm test` covers absolute diffs, boundaries, metadata mismatches, malformed imports, snapshot freshness, timeout/disconnect behavior, serialization, hidden records, restoration and byte preservation. `npm run check` recursively syntax-checks source, tests and tools. Optional `node tools/browser-smoke.mjs [base-url]` exercises the real UI with a simulated WebHID device, including the deployed Pages URL. It never opens hardware.
