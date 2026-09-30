# Notes for the designer: red-biobuzz-realistic.pp

What is real, what is estimated, and what is easy to get wrong about BIOBUZZ. "Robot code" means
`Mona-Shores-FTC-Robotics/biobuzz` (branch `claude/focused-tesla-s1374m`).

## Commands and triggers

- **Registered in the robot code today** (`AutoRegistration.java`, and `TeamCode/auto-registry.json`
  which the editor loads): triggers **`RightCellDown`**, **`LeftCellDown`**, **`CameraBlind`**.
  **No commands yet**: the robot code says "there is no intake, launcher or turret here, because
  none is designed yet".
- **Used in this Auto but not registered yet** (the names we plan to use): commands **`LaunchAll`**
  (will likely be SpinUp + Launch inside) and **`IntakeOn`**; trigger **`IntakeFull`** (holding 4
  POLLEN; the intake is expected to stop itself at 4, so there is no IntakeOff step). The editor
  will flag them until the robot registers them.
- `RightCellDown` is true from the moment our RIGHT CELL starts down (a started TIP always finishes);
  `LeftCellDown` is the tip back. Both read what the camera sees *now*, so a TIP during the
  launch already counts when the wait starts.

## Durations

- **Nothing is measured yet.** The launcher exists only as a test rig; no spin-up, feed or intake
  times are recorded anywhere.
- **LaunchAll: 3.0 s typical, 5 s timeout (estimate).** Spin-up to speed (the rig requires 250 ms
  steady at speed, target 1500 rpm) plus feeding 4 POLLEN.
- **IntakeOn: 0.2 s (estimate)**, it only starts the intake. **Waiting for IntakeFull at a
  FLOWER: at most 2 s** (the Auto's own limit; the real time is unknown).
- **Every command step times out at 5 s unless set** (IntakeOn is set to 1 s here).

## Robot settings used

- **Our drivetrain is not tuned yet** (every Pedro constant in the robot code is a placeholder), so
  the times use the **Visualizer's defaults**: max velocity **40 in/s**, acceleration and
  deceleration **30 in/s²**, turning **180°/s**. Tuned numbers will change every time; the
  proportions between routes should hold.
- **Robot size 18 × 18 in**, the legal starting-size limit (we have no measured robot yet), so
  every clearance is checked against the largest robot we could have.

## BIOBUZZ geometry the designer is likely to get wrong

Field positions come from measuring the field image in the tool (±0.5 in); the robot code's own
field points are still empty.

- **The Auto is drawn for RED: our half is x < 70.8.** The robot's footprint never crosses the
  center line. The closest it gets is 1.3 in.
- **Only one lane runs through the middle of our half:** under the HIVE, between the red frame leg
  (x 46.6–49.4, y 51.2–90.3) and the center line. An 18 in robot fits only for x 58.4–61.8 there,
  with about 1.6 in either side, so that route is a straight line up x = 60. Everything else goes
  around the frame's outside, x ≤ 37.6. Driving under the HIVE is legal and the robot fits
  underneath.
- **The upward CELLs start the match holding 3 NECTAR,** and a HIVE is calibrated to tip at
  3 NECTAR + 3 POLLEN. So our 4 preloads should tip it by themselves: in real matches the
  first wait is usually ✓, and the "not tipped" retry route is the exception. Later tips need
  about 8 POLLEN, because the CELL empties when it tips.
- **Where shooting is possible:** the rules say nothing about where to launch from, only that
  POLLEN must go into the *upward* CELL through its opening (not at its sides or bottom). We have
  no launcher yet, so this Auto assumes it can reach the CELL from 25–40 in away and turns to face
  the CELL while driving ("face point" heading). The GARDEN CELL (centre 57.9, 60.3) is up at the
  start. After the tip, the LOADING CELL (57.9, 86.9) is up, so the second launch aims there.
- **FLOWERs we use:**
  - the **LOADING FLOWER** on the rear wall (about 47.1, 138.2);
  - the **GARDEN FLOWER** on the red wall (about 3.4, 47.5).
  
  POLLEN may only be *taken* from a FLOWER through its bottom retrieval opening. The robot stops
  about half an inch short of each (an estimate: we have not measured a FLOWER's footprint). The
  two FLOWERs on the blue walls are on the opponents' side.
- **GARDEN POLLEN** (4 pieces) lie in a line along the audience wall, starting in the GARDEN's
  corner nearest our alliance area, around x 11–23. The robot sweeps along the wall facing −x to
  pick them up. It must not spin in place near a wall: turning, an 18 in robot reaches 12.7 in
  from its centre.
- **LOADING ZONE** (our park): x 0.3–11.4, y 94.6–117.7, against the red wall. Parking only needs
  part of the robot in it: Park (16.0, 106.0) puts 4.4 in inside. It must also not touch the wall,
  for the LEAVE points. The start must *not* be in it.
- **The start** has to touch a wall, be fully on our side and not touch a FLOWER. Start (60.0, 9.0)
  has its back on the audience wall, right in front of our GARDEN CELL.
- **The partner robot shares our half** and has to start touching a wall too. Where it runs is
  agreed per match, so there is no fixed answer. What's certain is that the under-HIVE lane
  and the LOADING ZONE are the likely collision points, so overlaying the partner's Auto
  matters.

## Gaps this Auto exposed (for the design, not the data)

- **Routes cannot rejoin when another route ends at park.** A step after a decision runs after
  *every* route, including the one that parked. So the main plan is written out twice, once for
  "tipped" and once for "tipped on the retry".
- **The Path List still decides where a path starts.** Three grey "never driven" link paths only
  exist to make the next path start in the right place.
- **The automatic park checks only between steps.** It doesn't interrupt a wait, and it drives
  the route's park path even if that path starts somewhere else. In the slowest outcome that
  ends the Auto at 31.0 s (see timings.md).
