# Sample Autos

Open a `.pp` here in the editor (☰ → open file), then press **Auto**. Each has its exported Java beside it.

## `red-garden-basic.pp`

A basic BIOBUZZ Auto, drawn for RED (the robot mirrors it for BLUE):

1. Shoot the 4 preloads (the turret aims; the robot only points its intake).
2. Wait for the first of: our HIVE tipped (or the camera is blind) → **If tipped**; 5 s → **If not tipped**.
3. **If tipped:** two collect passes from the start with the intake on (12 in straight ahead and
   back, then 12 in at 20° to the left and back); one tile forward to the gap under the HIVE;
   under the HIVE to the rear; shoot; take 4 POLLEN from the RED_LOADING FLOWER; shoot; park in
   the red LOADING ZONE.
4. **If not tipped:** straight under the HIVE; take 4 POLLEN from the RED_LOADING FLOWER; shoot at
   the RED_GARDEN CELL to try for the tip; park in the red LOADING ZONE.

It never lets the robot body overlap the center line (x = 70.75) and never drives through a wall or
a HIVE frame leg. Under the HIVE, an 18 in robot has 1.6 in to the frame leg and 1.8 in to the
center line.

**Placeholders to measure on the field before running it:** `Start` (60.0, 20.0, 90),
`LoadingFlower` (47.0, 124.0, 90), `Park` (18.0, 106.0, 90), and the robot's real width (18 in
assumed). Field positions (frame legs, center line, zones) were measured from the editor's field
image; check the frame legs with a tape measure, since the under-HIVE gap depends on them.

## `red-garden-no-turret.pp`

The same plan for a robot **without a turret**. The launcher is assumed fixed and to fire the way the
intake faces, so the robot turns to face each CELL before it shoots. If our launcher fires out the
back instead, every shot heading flips by 180°.

- **Preloads:** `Start` faces 93.0°, straight at the RED_GARDEN CELL (40.3 in away).
- **If tipped:** the same collect passes and the same route under the HIVE. It then moves over to
  (52.0, 112.0), where an 18 in robot has room to spin (it sweeps a 12.7 in radius), and turns
  165.7° to face the RED_LOADING CELL and shoot (23.8 in). It picks up from the RED_LOADING FLOWER,
  turns 162.7° to shoot again (36.8 in), and parks.
- **If not tipped:** a shot over the HIVE from the rear would be a long, blind lob without a turret,
  so this branch stays on the audience side instead. It takes 4 POLLEN from the **RED_GARDEN
  FLOWER** on the red wall, turns 159.3° to face the RED_GARDEN CELL (36.2 in) and shoots, then
  drives up the red wall to park.
- The editor chains each path from the one before it in the Path List, so both branches leaving
  `Start` need one **connector** path (grey, "never driven") to bring the chain back to `Start`. No
  card drives it.

| | With turret | Without turret |
|---|---|---|
| Tipped: preview end (turns added) | 18.5 s | 19.9 s (about 21.7 s with turns) |
| Not tipped: preview end (turns added) | 16.8 s | 15.9 s (about 16.8 s with turns) |
| Worst case (every wait times out) | 23.0 s | 24.4 s (about 26.2 s with turns) |
| Big turns | none | three turns of about 160°, about 0.9 s each at 180°/s |
| Tightest clearance | 1.6 in to the frame leg under the HIVE | same |

The Auto preview charges only for distance driven, so the "turns added" figures add angle ÷ 180°/s
for each turn made while barely moving. Both speeds are placeholders until
[biobuzz#113](https://github.com/Mona-Shores-FTC-Robotics/biobuzz/issues/113) measures the real ones.
