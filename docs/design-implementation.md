# From the design canvas to the tool: big picture

Where the design is heading (canvas "Auto builder · BIOBUZZ", latest: Concept B iteration 4,
"Stops"), what it takes to build, and the decisions that shape it. Written from the boards as of
2026-09-30; update when the canvas moves.

## What the design converged on

- **Three panes, each can be hidden:** Field · Auto · Spots (with Outcomes). "Structure only" hides
  the field and spots and gives the whole screen to the Auto, with a palette of the robot's
  commands, triggers and spots.
- **The Auto is a list of stops.** A stop is "drive to a named spot, then act": its header shows
  the spot, the path that gets there and its time (`LoadingFlower · StartToFlower · 4.4 s · 47.0
  125.5 90°`); under it are commands (`IntakeOn ≤1 s`) and waits (`wait for IntakeFull ≤2 s`). A
  stop can also stay put ("still at Start").
- **Spots are first class:** one table of x / y / heading, edited by typing; moving a spot moves
  every path that ends there. Names on the field show on hover.
- **Branching:** a wait on a trigger splits the list: the ✓ side just continues; the timed-out side
  is a named route, collapsed to "timed out · retry · 3 stops". A route can **rejoin the main plan
  at a stop** or end at a **park** stop (P).
- **Preview:** trigger chips in the top bar (✓ RightCellDown …) choose the route shown; an
  **Outcomes** table lists every route's time with the 30 s line, with and without the
  non-branching waits timing out.
- From Concept A, worth keeping: the add bar (Command / Path / Wait + the robot's names), the wait
  popover ("Wait for [trigger] at most [3.0] s · Two routes / One route"), "this wait only" preview
  override, event-day nudges with before/after times, exact path editing (split, piecewise
  heading), export with checks and RED/BLUE files, the Robot and field drawer.

## The one big change: a stop-based model

Today's file is a card tree plus a Path List, and a path starts where the previous one *in the
list* ends. The design assumes what the mentor has asked for all along: **a path belongs to its
stop and starts wherever the robot is.** That is a new model, not a new skin:

```
Auto   { start: Pose, spots: Spot[], main: Route, routes: Route[] }
Spot   { name, x, y, headingDeg }
Route  { name, stops: Stop[], end: "continue" | { rejoin: stopId } | "park" }
Stop   { id, spot?: name,               // none = stay where the robot is
         path?: { name, controls[], heading, isPark },
         steps: (Command | Wait)[] }
Command{ name, timeoutS? }               // typical time comes from the robot's list
Wait   { trigger, maxS, timedOut?: routeName }   // no timedOut = one route (plain wait)
```

What it fixes, all of which the realistic Auto hit:

- **No Path List ordering and no grey link paths.** A path's start is the previous stop's spot.
- **Rejoin without copying.** The main plan is written once; the retry route points at a stop in
  it. In the exported Java the part of the main plan from that stop on becomes one method both
  routes call.
- **Spots are the only positions.** Paths end on spots by construction, so the "pins" layer goes
  away.

What stays: the robot library (`autokit`: commands with timeouts, triggers, `firstOf`, paths),
the preview engine's timing and the Java generator's pieces. The editor keeps reading today's
`.pp` files by converting them (cards → stops) once, on open.

## Build order

1. **Model and engine (no new screens).** The stop model, conversion from today's files, the
   preview and outcome enumeration on it (the design's Outcomes table is exactly what
   `docs/design-data/analyze.mjs` computes), and Java export with shared rejoin methods. Tested
   against the realistic Auto: same times, no duplicated main plan, no link paths.
2. **The three panes.** Auto list of stops (drag to reorder, add bar, wait popover, collapsed
   routes), Spots table with hover names on the field, trigger chips and Outcomes.
3. **Path editing.** Click a stop's path: its control points and heading inline (the design has
   not placed this since B3; see questions), aligned-value guides, snapping to tenths, split and
   piecewise heading.
4. **Event day and files.** Nudge a spot with before/after times, the Robot and field drawer
   (size, speed, robot list), export with checks and RED/BLUE files, duplicate-and-mirror.

## Decisions needed (each changes the model or the engine)

1. **Rejoin target:** a stop (B4) or any step (B3 rejoined at IntakeOn)? Recommend: a stop.
2. **The ✓ side:** always "continue the list" (B4), or can it also jump to a named route?
   Recommend: continue only; a ✓ that needs a different plan is a route that rejoins.
3. **Plain waits:** keep the design's implicit "no timed-out route = one route", or an explicit
   Two routes / One route switch (Concept A)? Recommend: the switch, defaulting to One route.
4. **Automatic park:** the design shows only explicit park stops, and the realistic Auto ends at
   31.0 s in one outcome. Recommend: park is a **spot**, and the robot drives there from wherever
   it is (the path is generated at run time), checked during waits as well as between steps;
   show it on the timeline as a dashed "bail out here" marker.
5. **Repeated triggers in the preview:** RightCellDown is asked twice. One chip for both plus a
   "this wait only" override (Concept A)? Recommend: yes.
6. **Planned names:** commands and triggers the robot does not register yet ("planned"). Allow
   them in the editor but block export? Recommend: yes, with the export check listing them.

## Not yet designed

- Where a path's control points and heading are edited in B4 (B3 had it in a Paths table).
- How a step is added in B4 (no add control on the board).
- The Robot and field drawer, export and files in the B layout (only in Concept A).
