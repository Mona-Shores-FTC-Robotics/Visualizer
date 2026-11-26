# Real data from biobuzz

Copied by `scripts/refresh-biobuzz-fixtures.mjs`; do not edit by hand.

- `autos/`: `TeamCode/autos/*.pp` on biobuzz `master` at 10112c72.
- `sim/<auto>.pp`: the exact file the simulator ran; `sim/<auto>.json`: a summary of its runs on the `sim-results` branch (median drive time per path, median time of each TIP).
- `real/<auto>.pp`: the drawings robot 20245 ran on 25 Oct 2026 (biobuzz d11eb1af); `real/timing.json`: the team's timing facts (`claude/simulator` at cb16642b); `real/2026-10-25.json`: what the robot did, by hand from `doc/real-vs-sim-25-oct.md` there.
- `controls-heading-lock.json`: `TeamCode/cheat-sheets/controls.json` on biobuzz `claude/heading-lock-r1` at fd4e6448 (PR #748, not yet merged): the driver's R1 is HEADING_LOCK and TURRET_LOCK is the operator's Triangle held `turretModeHoldMs`. Once #748 merges, `controls.json` is refreshed from master and this copy can go.
- `match-page.json`: `TeamCode/cheat-sheets/match-page.json` from biobuzz PR #765 (`claude/match-page-export` at c32ce643, MatchPageExport; not yet merged): the TeleOp's Match page, row by row, for the drill's Driver Station panel. Once #765 merges, refresh it from master.
