# Sample Autos

**Open in the Visualizer:** [spot map](https://mona-shores-ftc-robotics.github.io/Visualizer/#sample=red-spot-map) · [simple](https://mona-shores-ftc-robotics.github.io/Visualizer/#sample=red-simple) · [basic (turret)](https://mona-shores-ftc-robotics.github.io/Visualizer/#sample=red-garden-basic) · [no turret](https://mona-shores-ftc-robotics.github.io/Visualizer/#sample=red-garden-no-turret)

These sample links open the files in this folder as last deployed, so they never go stale. Each
opens as a shared copy: change anything, and "Save as new file" keeps your version.

## `red-spot-map.pp`

Not an Auto: a tour of every named spot, so their names show on the field and they can be moved
to where they make sense. Spots are named as seen from your alliance area (where the drivers and
human player stand): LEFT_ is the wall on your left, RIGHT_ the wall on your right, YOUR_WALL the
wall you stand behind. For red, left is the back wall. Paired LEFT_/RIGHT_ spots mirror across y = 70.75, and both robots get a LOADING ZONE spot. Drag a spot's end on the field, or type it
in Setup → Named points; every path ending there moves with it.

## `red-simple.pp`

The smallest useful Auto, for learning the editor: shoot the preloads, then wait up to 3 s for the
HIVE to tip. **Tipped:** drive straight under the HIVE to `RearShot` and shoot. **Not tipped:**
curve over to `Garden` beside the red GARDEN, turning to face the red wall (a placeholder spot).
The grey "Back to Start (never driven)" path is only there because the editor chains every path
from the one before it in the Path List; no card drives it.

## Commands and triggers

**Commands** are what the robot does (`LaunchAll`). Each step runs until the command finishes or
its timeout (5 s unless the step sets another), and the preview uses the command's typical time
from the robot's list (`LaunchAll` ≈ 3 s). **Triggers** are true/false: `Tip` is "our HIVE has
started to TIP since this wait began"; `IntakeFull` is "holding 4 POLLEN right now". The first
wait runs **while LaunchAll**: the launch and the watching overlap, and the launch stops as soon as
the TIP is seen. The only other timing is each wait's time limit, so a missed TIP or a jammed
intake cannot stop the Auto.

**The intake is not in these Autos.** Collecting whenever the robot is not full and not launching
is how the robot works (a low-priority command the launch pauses), so the only intake step left is
**wait for IntakeFull** at a FLOWER.

## Rules every Auto here follows

From the BIOBUZZ Competition Manual, TU02 (Section 10 Game Details, Section 11 Game Rules):

| Rule | What it means for an Auto | How these samples meet it |
|---|---|---|
| G304 setup | Start fully on our side (red = FIELD columns A–C, x < 70.75), **touching the perimeter wall**, not touching a FLOWER, **not in the LOADING ZONE**, inside the starting size, touching exactly 4 POLLEN preloads, and motionless once INIT finishes | `Start` (60.0, 9.0, 90): back flush on the audience wall, footprint x 51.0–69.0. No FLOWER near it (the audience-wall FLOWER is at x ≈ 94), and it's nowhere near a LOADING ZONE. INIT only checks names and builds the follower, so nothing moves. |
| G402 | Don't disrupt the other alliance's Auto. Entering their side is "risky" and may be judged STRATEGIC | The robot body never crosses x = 70.75; the closest it gets is 1.8 in, under the HIVE |
| G407 | Never CONTROL more than 4 SCORING ELEMENTS | Every pickup comes after the previous load is shot. The intake must stop at 4 (`IntakeFull` means "holding 4") |
| G417 | Only LAUNCHING may move the HIVE. Touching it, directly or through POLLEN we hold, is likely STRATEGIC; accidentally bumping the frame while picking up POLLEN is not | The paths clear both frame legs (1.6 in at the gap under the HIVE). Nothing on the robot, POLLEN included, may touch a CELL while passing under it; check that on the robot with the LOADING CELL down |
| G418 | POLLEN comes out of a FLOWER only from the bottom (retrieval opening). Don't shake the FLOWER or ram the wall to knock POLLEN out | The pickups face the FLOWER's opening and arrive decelerating. The no-turret sample stops 8.5 in from the wall; the basic sample's `LoadingFlower` (47.0, 129.8) puts the robot's front 2.7 in from the wall, which by the field image is inside the FLOWER's footprint, so measure it before running |
| G405 / G406 | Don't eject SCORING ELEMENTS from the field; don't damage the ARENA | Shots are aimed at CELLs from inside our half |
| G403 | No powered movement between AUTO and TELEOP | The Auto finishes by 30 s with room to spare, and the Driver Station's 30 s AUTO timer (required by G305) stops the OpMode |
| 10.5.4 LEAVE (3 pts) | At the end of AUTO, not touching the perimeter wall | Every branch ends at `Park`, 4.4–7.0 in off the wall |
| 10.5.4 PARK (5 pts) | At the end of AUTO, at least partly in our LOADING ZONE | `Park` (16.0, 106.0) puts 4.4–7.0 in of the robot inside the zone (x ≤ 11.4, y 94.6–117.7) |
| 10.5.5 HIVE TIP (20 pts each) | Every TIP completed before TELEOP counts for AUTO. POLLEN left in a CELL only scores at the end of the match | A tip takes **8 POLLEN** (Event Field Setup Guide §12.3: 7 tossed in must not tip, the 8th must), and in AUTO there is no NECTAR (G401), so one robot's 4 preloads can't tip the HIVE alone. The tipped branch then puts its GARDEN 4 and LOADING FLOWER 4 into the now-UP RED_LOADING CELL: exactly 8, a second tip if every shot goes in |

Our own rules on top: never drive through a wall or a HIVE frame leg; coordinates with at most
one decimal place; field positions are placeholders until measured.


Open a `.pp` here in the editor (☰ → open file), then press **Auto**. Each has its exported Java beside it.

Both start **touching the audience wall** (every Auto must start touching a wall): `Start` =
(60.0, 9.0, 90), the back of an 18 in robot flush with the wall, intake toward the RED_GARDEN CELL.
The collect passes return to `CollectHome` (60.0, 10.0), 1 in off the wall, so the robot never
drives back into the wall; the not-tipped branch leaves from there too, 1 in from where the robot
sat, which Pedro absorbs.

## `red-garden-basic.pp`

A basic BIOBUZZ Auto, drawn for RED (the robot mirrors it for BLUE):

1. Launch the 4 preloads and watch the HIVE at the same time: wait for `Tip` while `LaunchAll`
   (the turret aims, the robot only points its intake) → **If tipped**; 8 s → **If not tipped**.
2. **If tipped:** two collect passes from the start with the intake on (about 20 in straight ahead
   and back, then about 21 in at 27° to the left and back); one path straight through the gap under
   the HIVE (entering at 60.0, 46.8) to `RearShot` at the rear, without stopping at the entrance; shoot; take 4 POLLEN from the RED_LOADING FLOWER; shoot; park in
   the red LOADING ZONE.
3. **If not tipped:** straight under the HIVE; take 4 POLLEN from the RED_LOADING FLOWER; shoot at
   the RED_GARDEN CELL to try for the tip; park in the red LOADING ZONE.

It never lets the robot body overlap the center line (x = 70.75) and never drives through a wall or
a HIVE frame leg. Under the HIVE, an 18 in robot has 1.6 in to the frame leg and 1.8 in to the
center line. The basic sample's `CollectAhead` (60.8, 29.5) comes within 1.0 in of the center line.

**Placeholders to measure on the field before running it:** `Start` (60.0, 9.0, 90),
`LoadingFlower` (47.0, 129.8, 90), `Park` (16.0, 106.0), and the robot's real width (18 in
assumed). Field positions (frame legs, center line, zones) were measured from the editor's field
image; check the frame legs with a tape measure, since the under-HIVE gap depends on them.

## `red-garden-no-turret.pp`

The same plan for a robot **without a turret**. The launcher is assumed fixed and to fire the way the
intake faces, so the robot turns to face each CELL before it shoots. If our launcher fires out the
back instead, every shot heading flips by 180°.
Each shot heading aims at a CELL's centre, measured from the field image: RED_GARDEN (57.9, 60.3)
and RED_LOADING (57.9, 86.9).

- **Preloads:** from `Start`, facing 90°. The CELL's centre is 2.3° to the left, so the shot lands
  about 2.1 in off centre on a 20 in opening. The robot can't start turned toward it, because it
  has to sit square against the wall.
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
| Tipped: preview end (turns added) | 19.1 s | 19.9 s (about 21.7 s with turns) |
| Not tipped: preview end (turns added) | 16.2 s | 16.1 s (about 17.0 s with turns) |
| Worst case (every wait times out) | 23.6 s | 24.4 s (about 26.2 s with turns) |
| Big turns | none | three turns of about 160°, about 0.9 s each at 180°/s |
| Tightest clearance | 1.6 in to the frame leg under the HIVE | same |

The Auto preview charges only for distance driven, so the "turns added" figures add angle ÷ 180°/s
for each turn made while barely moving. Both speeds are placeholders until
[biobuzz#113](https://github.com/Mona-Shores-FTC-Robotics/biobuzz/issues/113) measures the real ones.
