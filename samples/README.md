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
