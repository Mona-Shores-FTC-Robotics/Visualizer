# Real data from biobuzz

Copied by `scripts/refresh-biobuzz-fixtures.mjs`; do not edit by hand.

- `autos/`: `TeamCode/autos/*.pp` on biobuzz `master` at 10112c72.
- `sim/<auto>.pp`: the exact file the simulator ran; `sim/<auto>.json`: a summary of its runs on the `sim-results` branch (median drive time per path, median time of each TIP).
- `real/<auto>.pp`: the drawings robot 20245 ran on 25 Oct 2026 (biobuzz d11eb1af); `real/timing.json`: the team's timing facts (`claude/simulator` at cb16642b); `real/2026-10-25.json`: what the robot did, by hand from `doc/real-vs-sim-25-oct.md` there.
