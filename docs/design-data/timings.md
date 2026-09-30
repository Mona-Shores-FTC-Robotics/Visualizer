# Timings: red-biobuzz-realistic.pp

All times come from the Visualizer's own estimator (`simulateAuto` / `worstCase`, the same code
as the preview), run by `analyze.mjs` in this folder with the file's robot settings (see
notes.md: they are the tool's defaults, because our drive is not tuned yet). Command times are
the robot's typical times (LaunchAll 3.0 s, IntakeOn 0.2 s: **estimates**, see notes.md). A
trigger is either ✓ (true the moment it is asked) or ✗ (the wait runs to its time limit); real
matches fall between.

## Every outcome

HiveLeftGarden is asked twice (first wait, retry wait). A single ✓/✗ switch answers both, so the
"✗ at the first wait, ✓ at the retry" rows were run with the retry wait's trigger answered
separately.

| HiveLeftGarden | HiveLeftLoading | IntakeFull | Route | Ends at (s) | Bailout? |
|---|---|---|---|---:|---|
| ✓ | ✓ | ✓ | main plan → park | 13.89 | no |
| ✓ | ✓ | ✗ | main plan → park | 15.89 | no |
| ✓ | ✗ | ✓ | main plan → second FLOWER → park | 25.55 | no |
| ✓ | ✗ | ✗ | main plan → second FLOWER → park | 29.55 | no |
| ✗ | ✓ | ✓ | retry, then park (HiveLeftLoading never asked) | 19.83 | no |
| ✗ | ✓ | ✗ | retry, then park (HiveLeftLoading never asked) | 21.83 | no |
| ✗ | ✗ | ✓ | retry, then park (HiveLeftLoading never asked) | 19.83 | no |
| ✗ | ✗ | ✗ | retry, then park (HiveLeftLoading never asked) | 21.83 | no |
| ✗ first wait, ✓ retry | ✓ | ✓ | retry, rejoin main plan → park | 23.80 | no |
| ✗ first wait, ✓ retry | ✓ | ✗ | retry, rejoin main plan → park | 27.80 | no |
| ✗ first wait, ✓ retry | ✗ | ✓ | retry, rejoin main plan → second FLOWER → park | 30.00 | **yes** |
| ✗ first wait, ✓ retry | ✗ | ✗ | retry, rejoin main plan → second FLOWER → park | 31.03 (over 30 s) | **yes** |

- **Fastest:** 13.9 s (everything ✓). **Slowest outcome:** 31.0 s: the HIVE tips only on the retry,
  never tips back, and the intake never reports full.
- **Worst case (the tool's figure, every wait to its time limit on its longest route): 44.5 s**,
  which is why the automatic park exists. Only the two "tips on the retry, no tip back" outcomes
  need it.
- **The bailout fires late.** It checks between steps, not during a wait, so in the 31.0 s outcome
  it lets "Did the HIVE tip back?" run to 29.05 s and then parks over the limit. It also drives
  that route's park path (WestShotToPark), which starts at WestShot, not where the robot is
  (LoadingShot). Both are gaps in the tool and the robot library, not in this Auto; flagged in
  notes.md.

## Step by step

Durations of waits are the time actually waited; "at most" is the wait's limit.

### Main plan, everything goes right (HLG ✓ · HLL ✓ · IF ✓)

| Step | Kind | Start (s) | Duration (s) | Timeout / end spot · distance |
|---|---|---:|---:|---|
| LaunchAll | command | 0.00 | 3.00 | timeout 5 s |
| Did the HIVE tip? | wait | 3.00 | 0.00 | at most 3 s → Tipped: to the LOADING side (HiveLeftGarden true) |
| StartToFlower | path | 3.00 | 4.43 | → LoadingFlower · 123.8 in |
| IntakeOn | command | 7.43 | 0.20 | timeout 1 s |
| Collect at the LOADING FLOWER | wait | 7.63 | 0.00 | at most 2 s → IntakeFull true |
| FlowerToLoadingShot | path | 7.63 | 1.51 | → LoadingShot · 17 in |
| LaunchAll | command | 9.14 | 3.00 | timeout 5 s |
| Did the HIVE tip back? | wait | 12.14 | 0.00 | at most 3 s → Tipped back: park (HiveLeftLoading true) |
| ShotToPark (park) | path | 12.14 | 1.75 | → Park · 23.1 in |
| **End** | | **13.89** | | |

### Main plan, the HIVE does not tip back (second FLOWER) (HLG ✓ · HLL ✗ · IF ✓)

| Step | Kind | Start (s) | Duration (s) | Timeout / end spot · distance |
|---|---|---:|---:|---|
| LaunchAll | command | 0.00 | 3.00 | timeout 5 s |
| Did the HIVE tip? | wait | 3.00 | 0.00 | at most 3 s → Tipped: to the LOADING side (HiveLeftGarden true) |
| StartToFlower | path | 3.00 | 4.43 | → LoadingFlower · 123.8 in |
| IntakeOn | command | 7.43 | 0.20 | timeout 1 s |
| Collect at the LOADING FLOWER | wait | 7.63 | 0.00 | at most 2 s → IntakeFull true |
| FlowerToLoadingShot | path | 7.63 | 1.51 | → LoadingShot · 17 in |
| LaunchAll | command | 9.14 | 3.00 | timeout 5 s |
| Did the HIVE tip back? | wait | 12.14 | 3.00 | at most 3 s → Not tipped back: second FLOWER (3000 ms passed) |
| ShotToGardenFlower | path | 15.14 | 3.06 | → GardenFlower · 68.9 in |
| IntakeOn | command | 18.19 | 0.20 | timeout 1 s |
| Collect at the GARDEN FLOWER | wait | 18.39 | 0.00 | at most 2 s → IntakeFull true |
| GardenFlowerToWestShot | path | 18.39 | 2.18 | → WestShot · 35.5 in |
| LaunchAll | command | 20.57 | 3.00 | timeout 5 s |
| WestShotToPark (park) | path | 23.57 | 1.98 | → Park · 29.5 in |
| **End** | | **25.55** | | |

### Retry fails: the HIVE never tips (HLG ✗ · HLL ✗ · IF ✓)

| Step | Kind | Start (s) | Duration (s) | Timeout / end spot · distance |
|---|---|---:|---:|---|
| LaunchAll | command | 0.00 | 3.00 | timeout 5 s |
| Did the HIVE tip? | wait | 3.00 | 3.00 | at most 3 s → Not tipped: collect the GARDEN (3000 ms passed) |
| IntakeOn | command | 6.00 | 0.20 | timeout 1 s |
| GardenSweep | path | 6.20 | 2.48 | → GardenPickup · 46.2 in |
| Collect the GARDEN POLLEN | wait | 8.68 | 0.00 | at most 2 s → IntakeFull true |
| GardenToShot | path | 8.68 | 1.85 | → GardenShot · 25.6 in |
| LaunchAll | command | 10.53 | 3.00 | timeout 5 s |
| Did it tip this time? | wait | 13.53 | 3.00 | at most 3 s → Still not tipped: park (3000 ms passed) |
| RetryPark (park) | path | 16.53 | 3.30 | → Park · 78.6 in |
| **End** | | **19.83** | | |

### Longest: tips only on the retry, no tip back, intake never reports full (HLG ✗ then ✓ at retry · HLL ✗ · IF ✗)

| Step | Kind | Start (s) | Duration (s) | Timeout / end spot · distance |
|---|---|---:|---:|---|
| LaunchAll | command | 0.00 | 3.00 | timeout 5 s |
| Did the HIVE tip? | wait | 3.00 | 3.00 | at most 3 s → Not tipped: collect the GARDEN (3000 ms passed) |
| IntakeOn | command | 6.00 | 0.20 | timeout 1 s |
| GardenSweep | path | 6.20 | 2.48 | → GardenPickup · 46.2 in |
| Collect the GARDEN POLLEN | wait | 8.68 | 2.00 | at most 2 s → 2000 ms passed |
| GardenToShot | path | 10.68 | 1.85 | → GardenShot · 25.6 in |
| LaunchAll | command | 12.53 | 3.00 | timeout 5 s |
| Did it tip this time? | wait | 15.53 | 0.00 | at most 3 s → Tipped on the retry: rejoin (HiveLeftGarden@retry true) |
| GardenShotToFlower | path | 15.53 | 3.81 | → LoadingFlower · 99.1 in |
| IntakeOn | command | 19.34 | 0.20 | timeout 1 s |
| Collect at the LOADING FLOWER | wait | 19.54 | 2.00 | at most 2 s → 2000 ms passed |
| FlowerToLoadingShot | path | 21.54 | 1.51 | → LoadingShot · 17 in |
| LaunchAll | command | 23.05 | 3.00 | timeout 5 s |
| Did the HIVE tip back? | wait | 26.05 | 3.00 | at most 3 s → Not tipped back: second FLOWER (3000 ms passed) |
| Automatic park | bailout | 29.05 | 0.00 | 1.0 s left, WestShotToPark needs 2.0 s → park now |
| WestShotToPark (park) | path | 29.05 | 1.98 | → Park · 29.5 in |
| Over the 30 s Auto by 1.0 s | — | 31.03 | 0.00 |  |
| **End** | | **31.03** | | |


## Spots and paths

Positions in inches (Pedro frame: origin at the audience/red corner, x toward blue, y toward the
rear wall), headings in degrees counter-clockwise from +x. Paths are listed in Path List order:
each one starts where the one above it ends, which is why the file needs the three grey "never
driven" link paths.

| Spot | x | y | heading |
|---|---:|---:|---:|
| Start | 60.0 | 9.0 | 90° |
| LoadingFlower | 47.0 | 125.5 | 90° |
| LoadingShot | 38.0 | 112.0 | 308° |
| Park | 16.0 | 106.0 | 90° |
| GardenFlower | 16.5 | 47.5 | 180° |
| WestShot | 30.0 | 80.0 | 14° |
| GardenPickup | 20.0 | 10.0 | 180° |
| GardenShot | 36.0 | 30.0 | 54° |

| Path | From → to | Control points | Heading | Length (in) | Time (s) |
|---|---|---|---|---:|---:|
| StartToFlower | Start → LoadingFlower | (60.0, 124.0); (60.0, 127.0) | constant 90° | 123.8 | 4.43 |
| FlowerToLoadingShot | LoadingFlower → LoadingShot | (46.0, 116.0) | piecewise: 0.00–0.35 constant 90°; 0.35–1.00 face (57.9, 86.9) | 17 | 1.51 |
| ShotToPark | LoadingShot → Park | (26.0, 112.0) | linear 308° → 90° | 23.1 | 1.75 |
| Link to LoadingShot (never driven) | Park → LoadingShot | — (straight) | constant 90° | 22.8 | 1.74 |
| ShotToGardenFlower | LoadingShot → GardenFlower | (30.0, 96.0); (26.0, 50.0) | piecewise: 0.00–0.70 tangential; 0.70–1.00 linear 270° → 180° | 68.9 | 3.06 |
| GardenFlowerToWestShot | GardenFlower → WestShot | (26.0, 60.0) | piecewise: 0.00–1.00 face (57.9, 86.9) | 35.5 | 2.18 |
| WestShotToPark | WestShot → Park | (22.0, 96.0) | linear 14° → 90° | 29.5 | 1.98 |
| Link to Start (never driven) | Park → Start | — (straight) | constant 90° | 106.5 | 4.00 |
| GardenSweep | Start → GardenPickup | (52.0, 30.0); (36.0, 10.0) | piecewise: 0.00–0.50 linear 90° → 180°; 0.50–1.00 constant 180° | 46.2 | 2.48 |
| GardenToShot | GardenPickup → GardenShot | (28.0, 20.0) | piecewise: 0.00–0.30 constant 180°; 0.30–1.00 face (57.9, 60.3) | 25.6 | 1.85 |
| GardenShotToFlower | GardenShot → LoadingFlower | (30.0, 60.0); (30.0, 112.0) | piecewise: 0.00–0.75 tangential; 0.75–1.00 linear 60° → 90° | 99.1 | 3.81 |
| Link to GardenShot (never driven) | LoadingFlower → GardenShot | — (straight) | constant 90° | 96.1 | 3.74 |
| RetryPark | GardenShot → Park | (28.0, 70.0) | constant 90° | 78.6 | 3.30 |
