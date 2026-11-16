# Auto wording: what each wait says, and a proposal

For the mentor to review **before any `.pp` label changes.** Nothing in biobuzz changes with this
document. A label change is made in the Visualizer, then each changed `.pp` is re-exported
(`node scripts/export-auto.mjs <file.pp> <outDir>`, which reproduces master's generated Java
exactly), and committed in biobuzz with its generated Java. Never edit the Java by hand.

Taken from biobuzz `master`, `TeamCode/autos/`, on 15 Nov 2026, as the Visualizer's builder shows
them. Terms are from biobuzz `TeamCode/autos/timing-terms.md`. **CELL read up** (moment 8) is the
moment a camera facing the HIVE reports that CELL up. It is what `LeftCellUp`, `RightCellUp` and
`CellUp` wait for. An assumed or expected TIP never counts.

**Clocks.** Every "by N s" and "until N s" below is on the **robot's match clock, from its own
PLAY**. Every "in 0.75 s" is counted **from the moment the wait began** (the robot has just
arrived). In a playoff the robot's PLAY is 0.9 to 4.0 s behind the scoreboard.

## 1. Every wait, otherwise and choice label, as shown

The builder shows each wait in four places: its **title** (made from the trigger), its **Name**
(the `.pp` label, which also goes into the robot's log), its **Otherwise header** (made from the
trigger and time) and, for an INIT row, the **Driver Station line**. ⚠ marks the labels that are
cut off or ambiguous.

### R-Clockwise (`r-clockwise.pp`)

| #             | Title                         | Name (`.pp` label)                                    | Otherwise header                | Problem                                                                                                                                                                        |
| ------------- | ----------------------------- | ----------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 3             | Pickup: WALL_FLOWER or GARDEN | (same)                                                | Drawn: WALL_FLOWER / Or: GARDEN | DS: `Pickup ◀▶: WALL_FLOWER`. Clear                                                                                                                                            |
| 4             | Wait for Left CELL up         | R2: LEFT up by 15.5 s, otherwise park                 | If no Left CELL up by 15.5 s:   | ⚠ "up" should be "read up". Yes (shoot LEFT) is not said                                                                                                                       |
| 6             | If before 17.6 s              | Time for the scoring FLOWER: before 17.6 s            | At 17.6 s or later:             | ⚠ "Time for" reads like a length of time. It is a clock check. No (park) is not said                                                                                           |
| 9             | If before 22.2 s              | Time to look at the HIVE from the left: before 22.2 s | At 22.2 s or later:             | ⚠ "look" hides that this decides between going on to R3 and parking straight from the SCORING FLOWER                                                                           |
| 11            | Wait for Right CELL up        | **R3 RIGHT up by**                                    | If no Right CELL up by 23.2 s:  | ⚠ **Cut off**: no time and no outcome. The time is the INIT row (DS: `waiting for TIP 2 ◀▶ until 23.2 s`). No does **not** park: it shoots at LEFT to finish TIP 2, then parks |
| 11.2, 12 Or 1 | Wait until 26.4 s             | L has passed: park at 26.4 s                          | (none)                          | ⚠ Reads as a check on L. The robot checks only the clock                                                                                                                       |
| 12            | Priority: THREE_TIP or PARK   | (same)                                                | Drawn: THREE_TIP / Or: PARK     | DS: `Priority ◀▶: THREE_TIP`. Clear only if you know PARK means "keep the load and park"                                                                                       |

### L-Clockwise (`l-clockwise.pp`)

| Title                         | Name                                            | Otherwise header                | Problem                                                                                                                                                 |
| ----------------------------- | ----------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Wait for Left CELL up         | **L1 LEFT up by**                               | If no Left CELL up by 9.5 s:    | ⚠ **Cut off**, like R3. DS: `waiting for TIP 1 ◀▶ until 9.5 s`. No crosses under the HIVE, shoots at RIGHT from RIGHT_START to finish TIP 1, then parks |
| Wait until 22.5 s             | R has parked from the left spot: park at 22.5 s |                                 | ⚠ A claim about R, but only the clock is checked                                                                                                        |
| Pickup: GARDEN or WALL_FLOWER | (same)                                          | Drawn: GARDEN / Or: WALL_FLOWER | DS: `Pickup ◀▶: GARDEN`. Must be the opposite of R's                                                                                                    |
| Wait until 15.5 s             | R has passed the FLOWER: go at 15.5 s           |                                 | ⚠ As above                                                                                                                                              |
| Wait for Right CELL up        | L2: RIGHT up by 22 s, otherwise keep the load   | If no Right CELL up by 22 s:    | ⚠ "keep the load" leaves out that L holds until 22.7 s and then parks                                                                                   |
| Wait until 22.7 s (twice)     | R has left the scoring FLOWER: park at 22.7 s   |                                 | ⚠ As above                                                                                                                                              |

### R-Solo (`r-solo.pp`)

| Title                   | Name                 | Otherwise header                | Problem                                                                                                                                                                                                    |
| ----------------------- | -------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Wait for TIP or CELL up | **(empty)**          | If no TIP or CELL up in 0.75 s: | ⚠ No name, so the log shows only the title. "TIP or" is wrong: it waits only for the aimed CELL (here LEFT) to be read up. "in" vs "by" is the only sign that this 0.75 s is counted from the wait's start |
| Wait for TIP or CELL up | LEFT CELL still up?  | If no TIP or CELL up in 0.75 s: | ⚠ Neither answer is said (yes: shoot LEFT, park; no: park with the load)                                                                                                                                   |
| Wait for TIP or CELL up | RIGHT CELL still up? | If no TIP or CELL up in 0.75 s: | ⚠ As above, at RIGHT                                                                                                                                                                                       |

### R-NoCross (`r-no-cross.pp`)

| Title                   | Name                | Otherwise header              | Problem                                    |
| ----------------------- | ------------------- | ----------------------------- | ------------------------------------------ |
| Wait for TIP or CELL up | **(empty)**         | If no TIP or CELL up by 21 s: | ⚠ No name, and it is the aimed CELL, RIGHT |
| Wait for TIP or CELL up | RIGHT CELL back up? | If no TIP or CELL up by 22 s: | ⚠ No time in the name, and no outcomes     |

### L-NoCross (`l-no-cross.pp`)

| Title                                           | Name                 | Otherwise header               | Problem                                                                                                                                             |
| ----------------------------------------------- | -------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Wait for TIP or CELL up (spin up while waiting) | **(empty)**          | If no TIP or CELL up by 9 s:   | ⚠ No name. DS: `waiting for TIP 1 ◀▶ until 9 s`                                                                                                     |
| Wait for Left CELL up                           | **TIP seen?**        | If no Left CELL up in 0.75 s:  | ⚠ It asks whether **LEFT** is read up, from the **right** end, within 0.75 s. The row labels are the internal names "If LeftCellUp" and "Timed out" |
| Wait for Right CELL up                          | RIGHT CELL up?       | If no Right CELL up in 0.75 s: | ⚠ No outcomes. No skips the rest of this Otherwise                                                                                                  |
| Wait for Right CELL up                          | RIGHT CELL still up? | If no Right CELL up in 0.75 s: | Row labels "If RightCellUp" / "Timed out"                                                                                                           |
| Wait for TIP or CELL up                         | LEFT CELL up?        | If no TIP or CELL up by 23 s:  | ⚠ No time in the name                                                                                                                               |
| Wait for TIP or CELL up                         | LEFT CELL back up?   | If no TIP or CELL up by 23 s:  | ⚠ As above                                                                                                                                          |

### Draft R-Outside-lane (`drafts/r-outside-lane.pp`)

| Title                         | Name                                               | Otherwise header                | Problem                                                                                                                                                                                                                                                                                                                                          |
| ----------------------------- | -------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Pickup: WALL_FLOWER or GARDEN | (same)                                             |                                 | Clear                                                                                                                                                                                                                                                                                                                                            |
| Wait for Left CELL up         | LEFT up before 14 s, otherwise park                | If no Left CELL up by 14 s:     | "before" here, "by" in the Clockwise pair, for the same thing                                                                                                                                                                                                                                                                                    |
| Wait for TIP or CELL up       | **LEFT volley done before 15.5 s, otherwise park** | If no TIP or CELL up by 15.5 s: | ⚠ **The name does not say what is checked.** The trigger is `CellUp` at the LEFT spot: "LEFT still read up by 15.5 s". It passes at once only because the TIP lag (about 4.1 s) is longer than the volley, so in effect it is a clock check. It should probably be an "If before 15.5 s" step. **Check this with the mentor before relabelling** |
| Wait for Right CELL up        | RIGHT up before 26 s, otherwise park               | If no Right CELL up by 26 s:    |                                                                                                                                                                                                                                                                                                                                                  |

### Draft L-Under-hive (`drafts/l-under-hive.pp`)

| Title                         | Name                                 | Otherwise header             | Problem          |
| ----------------------------- | ------------------------------------ | ---------------------------- | ---------------- |
| Wait for Left CELL up         | LEFT up before 9 s, otherwise park   | If no Left CELL up by 9 s:   | "before" vs "by" |
| Pickup: GARDEN or WALL_FLOWER | (same)                               |                              |                  |
| Wait for Right CELL up        | RIGHT up before 22 s, otherwise park | If no Right CELL up by 22 s: |                  |

### Match view (fixed in this PR)

Before: "Pickup comes", "Always comes", "Priority comes", "LEFT CELL comes up", "RIGHT CELL comes
up". After:

- **INIT dropdowns** for the route choices, worded as the Driver Station's rows: "Pickup:
  WALL_FLOWER" / "Pickup: GARDEN", "Priority: THREE_TIP" / "Priority: PARK".
- **"Always" is gone.** It is the always-true trigger behind "If before N s". Only the clock
  decides that step, so there is nothing to switch.
- **Checkboxes** say what the robot waits for: "LEFT CELL read up", "RIGHT CELL read up", "Aimed
  CELL read up" (`CellUp`), "TIP read" (`Tip`), "Intake full", "Launcher empty", "Camera blind".
  The tooltip says that unticked, every wait on it runs to its limit and takes its Otherwise.

## 2. Each Auto's decision tree, in plain words

Times are on the robot's match clock unless they say "within".

### R-Clockwise (starts RIGHT_START, beside L-Clockwise)

1. Shoot the preloads at RIGHT (TIP 1).
2. **INIT Pickup.** WALL_FLOWER (drawn): pick the WALL FLOWER. GARDEN: gather in the GARDEN.
   Either way, drive the outside lane to LEFT_CLOSE_HIVE.
3. **R2: is LEFT read up by 15.5 s?**
   - **No:** park.
   - **Yes:** shoot at LEFT (TIP 2).
     1. **Before 17.6 s?** No: park. Yes: pick the SCORING FLOWER.
     2. **Before 22.2 s?** No: park from the SCORING FLOWER. Yes: turn to the HIVE at
        LEFT_CLOSE_HIVE.
     3. **R3: is RIGHT read up by 23.2 s (the INIT time, "TIP 2")?**
        - **No (TIP 2 has not come):** shoot the load at LEFT to finish TIP 2. Hold until 26.4 s,
          then park.
        - **Yes, INIT Priority THREE_TIP (drawn):** go under the HIVE to RIGHT_CLOSE_HIVE, shoot
          at RIGHT (TIP 3), and park if there is time.
        - **Yes, INIT Priority PARK:** keep the load. Hold until 26.4 s, then park.

### L-Clockwise (starts LEFT_START, beside R-Clockwise)

1. Slide to LEFT_WALL_HIVE.
2. **L1: is LEFT read up by 9.5 s (the INIT time, "TIP 1")?**
   - **No (TIP 1 has not come):** go under the HIVE to RIGHT_START, shoot the preloads at RIGHT to
     finish TIP 1. Hold until 22.5 s, then park.
   - **Yes:** shoot the preloads at LEFT.
     1. **INIT Pickup.** GARDEN (drawn): under the HIVE to the GARDEN, gather. WALL_FLOWER: under
        the HIVE to LANE_END, hold until 15.5 s, pick the WALL FLOWER. Either way, go to
        RIGHT_WALL_NEAR.
     2. **L2: is RIGHT read up by 22 s?** Yes: shoot at RIGHT. No: keep the load.
     3. Either way, hold until 22.7 s, then park at LEFT_PARK.

### R-Solo

1. Shoot the preloads at RIGHT. Pick the WALL FLOWER. Go to LEFT_LAUNCH_CLOSE.
2. **Is LEFT read up within 0.75 s?**
   - **Yes:** shoot at LEFT. Pick the SCORING FLOWER, back to LEFT_LAUNCH_CLOSE. **Is LEFT still
     read up within 0.75 s?** Yes: shoot at LEFT, park. No: park.
   - **No:** go to RIGHT_LAUNCH_CLOSE. **Is RIGHT still read up within 0.75 s?** Yes: shoot at
     RIGHT, park. No: park.

### R-NoCross

1. Shoot the preloads at RIGHT. Pick the WALL FLOWER. Go to RIGHT_LAUNCH_CATCH.
2. **Is RIGHT read up by 21 s?**
   - **No:** park.
   - **Yes:** shoot at RIGHT. Gather in the GARDEN, back to RIGHT_LAUNCH_CATCH. **Is RIGHT read up
     again by 22 s?** Yes: shoot at RIGHT, park. No: park.

### L-NoCross

1. Go to LEFT_LAUNCH_CATCH, spinning up. **Is LEFT read up by 9 s (the INIT time, "TIP 1")?**
   - **Yes:** go on to step 2.
   - **No:** go to RIGHT_LAUNCH_CLOSE. **Is LEFT read up within 0.75 s** (TIP 1 came late)? Yes:
     back to LEFT_LAUNCH_CATCH. No: **is RIGHT read up within 0.75 s?**
     - No: back to LEFT_LAUNCH_CATCH.
     - Yes: shoot the preloads at RIGHT. Pick the WALL FLOWER, back to RIGHT_LAUNCH_CLOSE. **Is
       RIGHT still read up within 0.75 s?** Yes: shoot at RIGHT. Either way, back to
       LEFT_LAUNCH_CATCH.
2. **Is LEFT read up by 23 s?**
   - **No:** park.
   - **Yes:** shoot at LEFT. Pick the SCORING FLOWER, back to LEFT_LAUNCH_CATCH. **Is LEFT read
     up again by 23 s?** Yes: shoot at LEFT, park. No: park.

### Draft R-Outside-lane

1. Shoot the preloads at RIGHT. **INIT Pickup**: the WALL FLOWER or the GARDEN, then the wall lane
   north to LEFT_CLOSE_HIVE.
2. **Is LEFT read up by 14 s?** No: park. Yes: shoot at LEFT.
3. **Is LEFT still read up by 15.5 s?** (Named "LEFT volley done", see above.) No: park. Yes: pick
   the SCORING FLOWER, then the wall lane south to RIGHT_CLOSE_NEAR.
4. **Is RIGHT read up by 26 s?** Yes: shoot at RIGHT, park. No: park.

### Draft L-Under-hive

1. Go to LEFT_CLOSE_HIVE. **Is LEFT read up by 9 s?** No: park. Yes: shoot the preloads at LEFT.
2. **INIT Pickup**: the GARDEN (drawn) or the WALL FLOWER, then to RIGHT_CLOSE_HIVE.
3. **Is RIGHT read up by 22 s?** Yes: shoot at RIGHT, park. No: park.

## 3. Proposed wording

One pattern for each kind of step. Every name says the question, the clock, and both answers.

| Step                                   | Pattern                                                                                | Example                                                                    |
| -------------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Wait for a CELL, by a match-clock time | `<stop>: <CELL> read up by <t> s? Yes: <do>. No: <do>.`                                | `R2: LEFT read up by 15.5 s? Yes: shoot LEFT. No: park.`                   |
| The same, time set in INIT             | `<stop>: <CELL> read up by the INIT time? Yes: … No: …` (the DS row shows the seconds) | `R3: RIGHT read up by the INIT time? Yes: Priority. No: shoot LEFT, park.` |
| Wait for a CELL, short window          | `<CELL> read up within <t> s? Yes: … No: …`                                            | `LEFT still read up within 0.75 s? Yes: shoot LEFT. No: park.`             |
| Clock check ("Always")                 | `Before <t> s? Yes: <do>. No: <do>.`                                                   | `Before 17.6 s? Yes: SCORING FLOWER. No: park.`                            |
| Hold for the partner                   | `Hold until <t> s (<why>)`                                                             | `Hold until 26.4 s (L passes)`                                             |
| Route choice                           | `<Option>: <leg> or <leg>` (unchanged; it matches the DS)                              | `Pickup: WALL_FLOWER or GARDEN`                                            |

Words: **read up** (never "up", "seen", "comes up" or "TIP seen" for a CELL trigger), **by** for
the match clock, **within** for since-the-wait-began, **Yes / No** for the two ways out, **hold**
for a wait on nothing but the clock. A TIP is named by its number (TIP 1, 2, 3) as the DS row
does.

### Visualizer code changes (one PR each, after review)

1. **Builder trigger names** (`src/lib/simple/steps.ts` `WAIT_FOR`, and so the titles): "TIP or
   CELL up" → "aimed CELL read up", "Left CELL up" → "LEFT CELL read up", "Right CELL up" → "RIGHT
   CELL read up", "TIP (since the wait began)" → "TIP read (since the wait began)".
2. **Otherwise headers** (`SimpleBuilder.svelte`): "If no Left CELL up by 9.5 s:" → "No: LEFT not
   read up by 9.5 s (match clock)". "If no … in 0.75 s:" → "No: … not read up within 0.75 s". "At
   17.6 s or later:" → "No: 17.6 s or later".
3. **A suggested name**: when a wait's Name is empty or stale, the builder offers the sentence in
   the pattern above, built from its trigger, time and the first step of each way. Then R-Solo's
   and the NoCross Autos' unnamed waits get names, and a name cannot fall behind its steps.
4. **Match timeline**: "wait · TIP 1" → "wait for TIP 1 (LEFT read up)".
5. Done in this PR: the Match view's what-ifs (section 1).

### `.pp`-only label changes (re-export each; no code)

| Auto                   | Now                                                   | Proposed                                                                                                                        |
| ---------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| R-Clockwise            | R2: LEFT up by 15.5 s, otherwise park                 | R2: LEFT read up by 15.5 s? Yes: shoot LEFT. No: park.                                                                          |
|                        | Time for the scoring FLOWER: before 17.6 s            | Before 17.6 s? Yes: SCORING FLOWER. No: park.                                                                                   |
|                        | Time to look at the HIVE from the left: before 22.2 s | Before 22.2 s? Yes: look at RIGHT from the left. No: park.                                                                      |
|                        | R3 RIGHT up by                                        | R3: RIGHT read up by the INIT time (TIP 2)? Yes: Priority. No: shoot LEFT, park.                                                |
|                        | L has passed: park at 26.4 s                          | Hold until 26.4 s (L passes), then park                                                                                         |
|                        | Priority: THREE_TIP or PARK                           | Unchanged; leg PARK could read KEEP_AND_PARK (also renames the DS row: mentor's call)                                           |
| L-Clockwise            | L1 LEFT up by                                         | L1: LEFT read up by the INIT time (TIP 1)? Yes: shoot LEFT. No: cross, shoot RIGHT, park.                                       |
|                        | R has parked from the left spot: park at 22.5 s       | Hold until 22.5 s (R parked), then park                                                                                         |
|                        | R has passed the FLOWER: go at 15.5 s                 | Hold until 15.5 s (R passes the FLOWER)                                                                                         |
|                        | L2: RIGHT up by 22 s, otherwise keep the load         | L2: RIGHT read up by 22 s? Yes: shoot RIGHT. No: keep the load.                                                                 |
|                        | R has left the scoring FLOWER: park at 22.7 s         | Hold until 22.7 s (R leaves the SCORING FLOWER), then park                                                                      |
| R-Solo                 | (empty)                                               | LEFT read up within 0.75 s? Yes: shoot LEFT. No: try RIGHT.                                                                     |
|                        | LEFT CELL still up?                                   | LEFT still read up within 0.75 s? Yes: shoot LEFT. No: park.                                                                    |
|                        | RIGHT CELL still up?                                  | RIGHT still read up within 0.75 s? Yes: shoot RIGHT. No: park.                                                                  |
| R-NoCross              | (empty)                                               | RIGHT read up by 21 s? Yes: shoot RIGHT. No: park.                                                                              |
|                        | RIGHT CELL back up?                                   | RIGHT read up again by 22 s? Yes: shoot RIGHT. No: park.                                                                        |
| L-NoCross              | (empty)                                               | TIP 1: LEFT read up by the INIT time? No: try RIGHT.                                                                            |
|                        | TIP seen? (rows "If LeftCellUp" / "Timed out")        | LEFT read up within 0.75 s (TIP 1 late)? Yes: back to LEFT. No: check RIGHT. (rows Yes / No)                                    |
|                        | RIGHT CELL up?                                        | RIGHT read up within 0.75 s? Yes: shoot RIGHT. No: back to LEFT.                                                                |
|                        | RIGHT CELL still up?                                  | RIGHT still read up within 0.75 s? Yes: shoot RIGHT. (rows Yes / No)                                                            |
|                        | LEFT CELL up?                                         | LEFT read up by 23 s? Yes: shoot LEFT. No: park.                                                                                |
|                        | LEFT CELL back up?                                    | LEFT read up again by 23 s? Yes: shoot LEFT. No: park.                                                                          |
| r-outside-lane (draft) | LEFT up before 14 s, otherwise park                   | LEFT read up by 14 s? Yes: shoot LEFT. No: park.                                                                                |
|                        | LEFT volley done before 15.5 s, otherwise park        | First decide: keep as "LEFT still read up by 15.5 s?", or make it a clock check "Before 15.5 s? Yes: SCORING FLOWER. No: park." |
|                        | RIGHT up before 26 s, otherwise park                  | RIGHT read up by 26 s? Yes: shoot RIGHT. No: park.                                                                              |
| l-under-hive (draft)   | LEFT up before 9 s, otherwise park                    | LEFT read up by 9 s? Yes: shoot LEFT. No: park.                                                                                 |
|                        | RIGHT up before 22 s, otherwise park                  | RIGHT read up by 22 s? Yes: shoot RIGHT. No: park.                                                                              |

**Before relabelling, check that a label is free text to the robot.** The names go into the match
log and the guard's messages, and the endgame guard uses a row's `label` as its guard label. A
`?` or `:` in a label must survive the export and any log tool that splits on them
(`tools/pull-logs/read_logs.py`). One re-export of R-Clockwise and a diff of its Java will
show it.
