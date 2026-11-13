# The `auto` section of a `.pp` file

This fork of the Pedro Pathing Visualizer adds an **Auto mode**: the Path List
becomes a whole 30-second Autonomous made of cards (commands, paths, and waits
for a trigger with a time limit, which is the one way to branch; plus an endgame
guard), previewed on the field and exported as Java for the robot's `autokit`
library.

A `.pp` file stays a normal Visualizer project file (format 2.0.0 since the
merge of upstream's v2.5; 1.5.0 files still open and are migrated on load) plus
**one** new top-level key, `auto`. Everything the Auto builder adds lives under
it, so:

- the stock Visualizer opens our files, but it **drops `auto` when it saves
  one**: edit and save Autos only in this fork, and
- a project without an Auto is written exactly as upstream writes it (no
  `auto` key).

The fork saves files as `.pp`, the name biobuzz's Autos, links and generated
class names use; upstream saves `.pp.json`, which also opens here.

## Using the editor

The fork is one screen: the **Auto** on the left, the **field** on the right.
A file without an Auto opens with one path card per path, in Path List order.

- **+ Command / + Wait for / + Decision / + Path** add a card after the
  selected card (or at the end of a selected branch). **+ Path** and the field's **+ Add Path** make a new
  path that starts where the robot is at that point of the Auto.
- Click a card to edit it in place, under the card. A path card shows
  **Ends at** and **Park path**; **more** has the path. Clicking a path on the field selects its card.
- Above the field: one switch per condition (**✓** happens, **✗** never
  does). Below it: the play bar, the time against 30 s and the worst case.
  While it plays, the running card is outlined.
- **Setup** (start pose, registry, named points, alliance, export name) and
  **Export** are in the Auto header.

## Shape

```json
"auto": {
  "version": 1,
  "drawnFor": "RED",
  "exportName": "hive-rush",
  "registry": { "actions": ["ShootAll", "SpinUp"], "conditions": ["LauncherReady", "HiveTipped"] },
  "points": { "ShootSpot": [38, 71], "UpCellShot": [108, 84, 45] },
  "cards": [
    { "id": "c1", "kind": "action", "name": "SpinUp" },
    { "id": "c2", "kind": "firstOf", "label": "Wait for LauncherReady",
      "rows": [ { "when": ["LauncherReady"], "cards": [] }, { "afterMs": 800, "cards": [] } ] },
    { "id": "c3", "kind": "path", "lineId": "<top-level path id>", "park": false },
    { "id": "c4", "kind": "firstOf", "label": "Did the HIVE tip?", "alongside": "ShootAll",
      "rows": [ { "when": ["HiveTipped"], "label": "If tipped", "cards": [ ... ] },
                { "afterMs": 1500, "label": "If not tipped", "cards": [ ... ] } ] }
  ]
}
```

A complete example that uses every card kind is
`src/lib/auto/fixtures/hive-rush.pp`; its exported Java is the golden file
`src/lib/codegen/auto/fixtures/HiveRushAuto.java`.

### Top level

| Key | Type | Meaning |
|---|---|---|
| `version` | `1` | Format version. A newer version loads with a warning. |
| `drawnFor` | `"RED"` \| `"BLUE"` | The alliance the Auto is drawn for; new Autos are drawn for RED. The robot turns it half a turn about the field centre for the other alliance (`PoseFactory.mirrorAroundPoint(70.75, 70.75)`); the editor never deals with BLUE. |
| `exportName` | string, optional | Name of the generated class before the `Auto` suffix. Defaults to the file name (`hive-rush.pp` → `HiveRushAuto`). |
| `registry.actions` | string[] | Robot actions the robot code registers. The editor cannot read robot code, so the file carries the list; dropdowns offer only these. |
| `registry.conditions` | string[] | Registered true/false conditions, likewise. |
| `registry.typicalS` | `{ name: seconds }`, optional | Each command's typical time, from the robot's list (`TeamCode/auto-registry.json`, loaded in Setup). |
| `registry.events` | string[], optional | The conditions that are events: once true, true for the rest of the match (`Tip1`). The rest are states, which can turn false again (`IntakeFull`). The editor shows which is which; the export does not use it. |
| `points` | `{ name: [x, y] \| [x, y, headingDeg] }` | Named points (inches, Pedro field frame). Exported as named `Pose` locals; a path endpoint that sits on a named point uses its name. |
| `pathEnds` | `{ pathId: pointName }` | Path ends that are named points (pins; see below), by the id of the path segment that ends there (a group's last segment). Always written, even empty. |
| `startAt` | string, optional | The named point the start pose is on. |
| `cards` | card[] | The Auto, top to bottom (the "trunk"). |
| `plays` | `{ id: play }`, optional | The plays this Auto's ladders use, copied in so the file stands alone (see "Ladders"). |
| `partner` | `{ auto, follows?, settings? }`, optional | Fork: the Auto this one is drawn to run beside (`"L-Clockwise"`), for the robot's INIT page. `follows` names a route choice of this Auto and `settings` says, for each of its legs in order, what the partner's same option must be set to (see "A paired Auto"). |
| `parkChoices` | string[], optional | Fork: other PARK spots the drive team may pick during INIT instead of the park step's own (gamepad 1's D-pad left and right; see "Options the drive team changes in INIT"). Each is one of `points`, usually a team spot. |

### Cards

Every card has a unique `id` (the editor addresses cards by it) and a `kind`.

| `kind` | Fields | Meaning |
|---|---|---|
| `action` | `name`, `timeoutS?`, `previewMs?` | Runs a registered **command** (the editor calls it that; the file keeps the key `action`). On the robot it runs until it finishes or `timeoutS` (default 5 s), exported as `kit.command(name[, timeoutS])`. The preview uses the command's typical time from `registry.typicalS`, else `previewMs` (older files), else instant, never past the timeout. |
| `path` | `lineId`, `park`, `through`? | Drives an existing path. `through`: the robot drives through this path's end without stopping, so it and the paths after it (up to the first without `through`) are one drive, exported as one Pedro path. `lineId` is the id of a **top-level** entry in the Path List (a path, or a group, which Pedro follows as one path). `park`: this is the branch's park path for the endgame guard. Nothing runs while it drives. |
| `firstOf` | `label`, `rows`, `alongside`?, `ladder`? | **Wait for a trigger, at most a time**: exactly one `when` row and one `afterMs` row. With no cards on either row it is a plain **Wait for**; with cards each row holds the rest of its route (a **decision**). `alongside` names a command run *while* it waits ("LaunchAll · wait for Tip"): it starts with the wait and is stopped when a row fires, if still running. `partnerWait: true` marks **the partner wait**, at most one per Auto: the drive team enters "the partner's last preload leaves at N s" in init and the robot sets this wait's time limit from it. The export writes its time row as `kit.afterMs(kit.partnerWaitMs(<afterMs>))`, so the card's own time stays in the Java as the default (and the preview keeps using it); an Auto with two is an error. A stock Visualizer ignores the key. |

| `rejoin` | `lineId`, `target` | Ends a route by joining another at one of its stops: drives `lineId` (from where the robot is to the spot the target stop ends on), then runs the steps after the target path card in its list. Those steps are shared by both routes. Must be the last step of its route; the target must not lead back to the rejoin. A drive-through target is joined on the move: the rejoin's path drives on through the rest of that chain in one drive, and the steps after the chain's last stop follow. |

Older files may hold `routine`, `goTo` and `together` cards, commands while driving (`while`,
`events`) and other row kinds (`timeLeftBelowS`, `otherwise`, `nearPoint`, `inArea`,
`finished`, or several triggers in one `when`). This editor drops them on load and lists
what it dropped; they may come back if a real Auto needs them.

### Rows

Each row has exactly one condition key, plus `cards` (possibly empty) and an
optional `label` (the branch's name; defaults to one made from the condition).

| Row | Becomes true |
|---|---|
| `{"when": ["A"]}` | when the registered trigger is true (a list for older files; one name) |
| `{"afterMs": 800}` | 800 ms after the card started |
| `{"afterMs": 8000, "matchClock": true}` | Fork: once the match clock reads 8 s, however late the card started (at once if it already does) |

A match-clock time row may also carry `"adjustable": true`: the drive team may move it during
INIT. Only one wait per Auto may (see below). Or it may carry `"option": "T2 LEFT up by"`: the time
is a row of the INIT menu under that name, set as it is; any number of waits may, and two rows with
one name are one time (see "A paired Auto").

A wait may hold one time row and nothing else: it stands still until that time ("hold until
22.7 s on the match clock"). A wait on the trigger `Always` asks only its time, since the time row
is checked first: "is it still before 19.4 s?" takes its time row when it is not and its trigger
row at once when it is.

Rules the editor enforces (errors block the Java export):

- every `firstOf` has exactly one trigger row and one time row, so nothing can wait forever;
- every action and condition name used anywhere is in the registry;
- a path card names a top-level path that exists;
- a list of cards has at most one park card;
- each of `parkChoices` is a named point other than the park's own, and every park path ends on
  the same spot;
- at most one wait is `adjustable`;
- a route choice's two legs each have a name and at least one step, hold only drives, commands
  and plain waits, and a choice used twice has the same leg names in the same order;
- a camera-or-timer stop has a trigger and a time on the match clock;
- one `option` name is one time, and is not also the partner wait;
- a partner note's `follows` names a route choice of the Auto.

Warnings (shown, not blocking): a path that starts more than 2 in from where
the robot can be when it starts; a park card that is not last in its branch; a
branch whose worst case runs past 30 s.

### Ladders

What the robot tries when a tip doesn't come. A ladder sits on a `firstOf` on the plan (the
main sequence, or the row an earlier wait takes when its trigger comes):

```json
"ladder": { "tries": [{ "play": "wall-flower" }, { "play": "garden", "shootS": 3 }] }
```

Each try names a play in the section's `plays`; `shootS` and `collectS` override the play's own
time limits for this Auto. A play is drives to named points, collects and shoots, with the
source it collects from and the points it needs:

```json
"wall-flower": {
  "id": "wall-flower", "name": "Refill at the wall FLOWER, shoot from FIRE3",
  "source": "WALL_FLOWER",
  "points": { "WALL_FLOWER_TURN": [23.16, 47.36, 180], "WALL_FLOWER": [14.86, 47.36, 180], "FIRE3": [45, 26, 90] },
  "steps": [
    { "kind": "drive", "to": "WALL_FLOWER_TURN" }, { "kind": "drive", "to": "WALL_FLOWER" },
    { "kind": "collect", "upToS": 3 }, { "kind": "drive", "to": "FIRE3" }, { "kind": "shoot", "upToS": 2.5 }
  ]
}
```

The plays the editor offers are the BIOBUZZ list in `src/lib/ladder/plays.ts`, written from the
named points the team's Autos share; the file keeps its own copy of each it uses.

**The ladder is built into ordinary cards** (`src/lib/ladder/compile.ts`), after every edit and
before the Java export, so the preview, the export and a stock Visualizer read the Auto as any
other. Cards and paths the ladder writes have ids starting `lad-<wait id>-`; the editor owns
them. A bend drawn on one of those paths is kept when the ladder is built again.

- The plan after the wait becomes the wait's `when` row, except the plan's park card, which stays
  at the end of its list so the endgame guard covers every route.
- The `afterMs` row is the ladder: each try's drives, collect (a wait for `IntakeFull`) and shot
  (`LaunchAll` alongside a wait for `Tip`); that wait's `when` row is what happens when the try
  works and its `afterMs` row is the next try.

Three fixed rules finish every route. Every outcome is decided when the Auto is built; the robot
never improvises.

1. **A try that works goes back to the plan**: a `rejoin` to the plan's next stop after the wait.
2. **A source is used once** (`FAR_FLOWER`, `WALL_FLOWER`, `GARDEN`: a wait for `IntakeFull` right
   after a drive to one). A try whose source the plan or an earlier try has used is skipped. When
   a try that works would send the robot back to a source already used, its route copies the plan
   up to the drive there instead of rejoining it.
3. **Every route ends where the plan's park starts** (a drive there when it ends elsewhere) and
   goes on to the park. When time runs short on any route, the endgame guard parks it. A path
   is never cut, so a long try can still run past 30 s: **All outcomes** shows each route's time,
   and one past 30 s is red.

### Loading

`normalizeAuto` (`src/lib/auto/normalize.ts`) never throws. It keeps what it
can, re-issues missing or duplicate ids, and returns a list of plain-English
problems for anything it dropped (unknown or retired card kinds and rows,
malformed points, …); the app shows them as
a toast. `serializeAuto` writes keys in a fixed order, so saving twice gives
the same bytes.

### Geometry

A path card uses exactly the geometry the stock Visualizer draws and exports:
a path starts where the previous path **in the Path List** ends. So two
branches that both leave the same spot need the Path List to reach that spot
before each of them; the discontinuity warning says when a card would start
somewhere the robot is not.

### Where a path starts: link paths

In a `.pp` file each path starts where the one above it in the Path List ends. In an Auto, a
path starts **where the robot is**: the start pose, or the end of the path before it in the
Auto. So the editor lays the Path List out in the order the Auto drives it (each wait's ✓ route,
then its timed-out route), and wherever a path must start somewhere else it puts a straight
**link path** in front of it, named "Link (never driven)". No card drives a link; `linkPaths`
lists their ids; the editor rebuilds them after every edit and hides them. A path the Auto drives
twice can start in only one place (its first use); paths no card drives keep their start and come
last. Hand-made links from older files (paths named "… never driven …" that no card drives) are
dropped. The file stays readable by the stock Visualizer, which draws every path where it
really starts.

### Named points and pins

A named point is a place with a name: `RearShot`, `Park`. Name the places
where the robot does something (shoots, picks up, parks) or where paths meet;
leave the rest unnamed. The Java uses the names, so they are also what to
change at an event.

A path end on a named point is **pinned** to it (`pathEnds`, and `startAt` for
the start). A pinned end has no position of its own; it is wherever its point
is. Edit the point and every end on it moves; drag a pinned end and the point
moves with it (to 0.1 in), and so does every other end on that point. Paths
still carry their end positions, so a stock Visualizer draws the file; the
editor keeps the two equal (`src/lib/auto/pins.ts`, applied in `App.svelte`
after every change). Choosing a point in "Ends at" moves the end onto the
point, never the reverse.

A file from before pins (no `pathEnds` key) is pinned when it opens: every
end and the start that already sit on a named point (within 0.05 in) are
pinned to it. A point that no end, start or card uses is drawn hollow on the
field and gets a warning; it is not exported.

## Generated Java

"Export Auto (Java)" writes `<ExportName>Auto.java` in package
`org.firstinspires.ftc.teamcode.opmodes.auto.generated`, following the
contract with the robot's `autokit` library:

- `SOURCE`, `SAVED` (when the .pp was saved, Michigan time, e.g. `10-31|12:22AM`, from its
  `timestamp`, empty when it has none; the OpMode's name on the Driver Station ends with it, so the
  drive team sees which save is on the robot), `COMMANDS`, `TRIGGERS` (every registered name used, sorted, no
  duplicates), `DRAWN_FOR`, `startPose(boolean rotated)`, a private
  `poses(boolean rotated)` factory and `build(AutoKit kit, boolean rotated)`;
- every pose is a `Pose` local built with `p.of(...)` so the robot's half-turn
  for the other alliance applies to all of them; named points first, then the
  other poses the paths need;
- paths are `Path` locals using the same expressions as the stock export
  (`Paths.line/curve/through/path` plus a heading suffix); `Interpolator` is
  imported only when a piecewise heading is used;
- the cards become one `kit.sequence(...)`; a `firstOf` becomes
  `kit.firstOf(label, rows...)`, or `kit.firstOf(label, kit.command(name), rows...)` with
  `alongside`; a row with cards is `kit.when(...).then(...)` or `kit.afterMs(...).then(...)`;
- a drive-through chain is one `kit.path("A → B → C", Paths.path(a, b, c))`;
- the steps after a stop that a rejoin joins at are one local
  `Supplier<Command> after<Spot> = () -> kit.sequence(...)`, declared before the Auto and called
  (`after<Spot>.get()`) by the route that stops there and by the rejoin, so they are written once
  (joining a drive-through, the rejoin's path and the rest of the chain are one `kit.path`, and
  `<Spot>` is the chain's last stop);
- the export lays the paths out as the editor does (link paths included) before writing, so a
  file straight from disk exports the same;
- a list that directly contains a park card is wrapped
  `kit.guarded(label, parkPath, seconds, cards...)`, where `seconds` is the
  park path's drive time by the preview's motion model, rounded **up** to
  0.1 s; the trunk's guard label is `"Auto"`, a branch's is its row label;
- a match-clock time row is `kit.atMatchSeconds(s)`; an adjustable one is
  `kit.atMatchSeconds(kit.seconds(label, s))`, the wait's label naming it;
- `OPTIONS`, always written (`{}` with none), lists what the drive team may change in INIT (see
  below).

### The simple builder's Choose step

A route choice (`choice` on a wait card, above) is a builder step, **Choose in INIT**: its name on
the INIT menu, and two legs, each a named list of drives and commands. The drive team picks a leg;
both end on the same spot and go on with the steps below. A choice sits in the main list. A leg
holds drives, commands and a wait for its time only ("hold until 15.5 s"). Where the choice is the
last step of the route, each leg may instead end with its own Park (both, or neither): each way
parks by its own road, nothing follows, and the list is guarded by the default leg's park.

A **clock check** is a builder step too, "If before 20.7 s: the steps below. Otherwise: …". It is
a wait card whose match-clock time row comes first and whose trigger row is the robot's `Always`
trigger: past the time the time row wins, before it the trigger does, at once, so the robot never
waits. It takes an Otherwise like any Wait, and its time may be the one the drive team sets in
INIT (`adjustable`).

A stop that shoots by the camera or the timer (`shot`) and a time on the INIT menu (`option`) are
not builder steps: the builder has no control for them, so it shows such a wait as an advanced step
and leaves it alone.

### The simple builder's Otherwise: go on, or instead

A Wait step's Otherwise is its time row's cards. An Otherwise is a list like the main one: it may
hold a Wait with an Otherwise of its own, to any depth. Each ends one of two ways.

With **then: go on with the steps below** (the default) the wait has no cards on its trigger row,
and both outcomes go on with the cards after the wait.

Otherwise it runs **instead of the steps below**: the wait is its list's last card and the steps
below it are its trigger row's cards, so each outcome holds the rest of its own route. The builder
shows both forms the same way, the steps below the wait in its list (`unfold`/`refold` in
`lib/simple/steps.ts`), and names the second by where the wait is:

- **then: park**, where nothing follows the wait's list: the main list, or the Otherwise of a wait
  that itself parks. The Otherwise ends with its own Park, as does every Otherwise inside it that
  runs instead, and each outcome is guarded with its own park. In an Auto made of builder steps
  only, a list that ends in such a wait is guarded too, by a park from the wait's spot, so the
  endgame guard watches the drives before it; a paired Auto's hand-made decisions keep the guards
  they were drawn with.
- **then: skip the steps below**, inside an Otherwise that goes on. No Park: the Otherwise just
  ends, and the robot goes on with the steps after the Otherwise it is in.

"Fire only if the CELL is up" is the first: Drive to the launch spot, Wait for CELL up with an
Otherwise that parks, then Launch all. Every Park step is on the Auto's one PARK spot.

Every drive the guard could park after has a park from its spot (`parkFrom`): in each route all
but the last drive before its Park, and every drive in an Otherwise that goes on.

### Options the drive team changes in INIT

A partner says in the queue where they park, or when they tip. The robot's INIT page shows each
option on one line, and gamepad 1's D-pad changes it (biobuzz `InitOptions`); nothing touched,
the Auto runs as drawn. The drawing's value is always the default.

- **The park.** With `parkChoices`, the export declares
  `Pose park = kit.pick(AutoOption.PARK, leftPark, rightPark)` (the drawn park first) and every
  park path (the park step's, each guard's, each spot's) ends on `park`: the same path with its
  end moved, control points kept. Each park's reserved time is
  `kit.pick(AutoOption.PARK, 1.9, 2.1)`, the second timed with the end moved, so the endgame
  guard reserves the picked park's time. `OPTIONS` holds `AutoOption.park("LEFT_PARK", "RIGHT_PARK")`.
  The preview and the simulator drive the drawn park.
- **The partner wait.** An adjustable match-clock limit is `AutoOption.matchSeconds(label, s)`. On
  the robot the drive team enters the partner's last shot, their answer to "when does your last
  preload leave?", and the wait gives up the TIP lag after it (biobuzz
  `AutoRegistration.PARTNER_TIP_LAG_S`, 4 s; the Driver Station shows both numbers); the preview
  uses the drawn time.

### A paired Auto: a route choice, shots by camera or timer, and its times

Two robots that run Autos drawn as a pair must agree on a few things before PLAY. Each is a row of
the robot's INIT menu (biobuzz `InitOptions`: D-pad up and down select a row, left and right change
it), and the page says what it assumes of the partner.

- **A route choice** is a `firstOf` with `"choice": "Pickup"`: not a wait, but two alternative
  legs. Its `when` row is the drawing's leg and names the option as its trigger
  (`"when": ["Pickup"]`), so the preview's switch for it picks the leg; its `afterMs` row (0) is
  the other. Each row's `label` is its choice's name, as the menu shows it. Both legs end on the
  same spot and the cards after the card follow either. The export writes each leg's cards one
  after the other, each on its own choice, so the list stays flat and the endgame guard plans
  through the picked leg as through any cards:

  ```java
  kit.route("Pickup", 0, () -> kit.path("to WALL_FLOWER_STAGING", toWallFlowerStaging, 2.1, flowerPark, 2.1)),
  kit.route("Pickup", 0, () -> kit.command("PickFlower", 4.5)),
  kit.route("Pickup", 1, () -> kit.path("to GARDEN_STAGING", toGardenStaging, 2, gardenPark, 2.8)),
  kit.route("Pickup", 1, () -> kit.command("GardenGather", 5.5)),
  ```

  `OPTIONS` holds `AutoOption.choice("Pickup", "WALL_FLOWER", "GARDEN")`, the drawing's first.
- **A stop that shoots by the camera or the timer** is a wait with `"shot": true`: "is this CELL
  up by this time?". By the camera its trigger row is yes and its match-clock row is no. With the
  menu's shot trigger on the timer the robot cannot see the HIVE, so the trigger row fires at the
  time and the time row never does. Exported as `kit.shotLimit(s)` and `kit.shotWhen(trigger, s)`;
  any such stop puts `AutoOption.shotTrigger()` in `OPTIONS`.
- **A time on the menu** is a match-clock row with `"option": "<name>"`: exported as
  `kit.seconds("<name>", s)` wherever the time is used, with `AutoOption.time("<name>", s)` in
  `OPTIONS`, in the order the Auto reaches them.
- **The partner note** (`partner`) becomes `AutoOption.partner("L-Clockwise", "Pickup", "GARDEN",
  "WALL_FLOWER")`: with our Pickup on its first leg the partner's must read GARDEN, on its second
  WALL_FLOWER. The INIT page shows it with the shot trigger, which must simply be the same.

The preview and the simulator drive the drawing's leg and the drawn times unless told otherwise
(biobuzz simulate requests: `"picks"`).

Complete examples: `test/fixtures/clockwise/r-clockwise.pp` and `l-clockwise.pp`, with the Java
they export beside them.

### Robot settings belong to the file

The preview's timing and the park guard's `seconds` come from the robot size
and motion model, which every file carries in its `robot` block (upstream's
format 2.0.0: `forwardVelocity`, `strafeVelocity`, `aVelocity`, `kFriction`,
`rLength`, `rWidth`, `safetyMargin`, `maxAcceleration`, `maxDeceleration`,
plus the fork's `maxVelocity`). A 1.5.0 file's `settings` block is migrated
into it on load (`xVelocity` → `forwardVelocity`, the old `rWidth`/`rHeight`
→ `rLength`/`rWidth`).

- **`maxVelocity` is the fork's.** It caps the trapezoidal profile; without
  it, as upstream does, the cap is the average of the forward and strafe
  velocities. Our Autos record a measured cap, so it is kept
  (`src/sim/motionProfile.ts`).
- Opening a file applies its robot; anything it lacks comes from the robot
  in use. `export-auto.mjs` uses the defaults for what a file lacks, and a
  test checks the app and the command line export the same Java.
- Display preferences (panels, colours, images, the field image) stay the
  viewer's and do not change when a file is opened.

From the command line, without opening the app:

```
node scripts/export-auto.mjs path/to/hive-rush.pp [outDir]
node scripts/save-auto.mjs path/to/source.pp path/to/biobuzz [drafts|partners]
```

The second saves into a biobuzz checkout as **Save to repo folder** does: the project is loaded,
laid out (link paths) and written as the editor writes it, to `TeamCode/autos/` (or its `drafts/`
or `partners/`), with its generated Java in the robot's folder. The source may be a project
assembled by a script, with its paths in any order and no link paths.

`pnpm test` runs the unit tests, including a golden test that exports the
sample and compares it with `HiveRushAuto.java` line by line. That golden file
compiles with `javac --release 8` against Pedro 3.0.1, Ivy and the contract's
`autokit` signatures, and its `build()` runs for both alliances.

## Preview

Each wait that branches has its **own switch**: **✓** its trigger fires, **✗** its
time limit passes. So "the HIVE did not tip at the first wait, but did at the retry" is two
switches. A **plain wait** (no cards on either row, like IntakeFull at a FLOWER) is not a switch:
one answer per trigger holds for every plain wait on it. The trigger chips above the field set
every wait on that trigger at once (± when they differ). Everything starts ✓ (the happy path);
the switches are not saved in the file.

✓ fires the moment the wait starts, or, with a command alongside, when the command would finish
(its typical time), since the launch is what tips the HIVE. ✗ runs to the limit. The in-between
is not previewed: a real run falls between them.

**Routes** (`src/lib/auto/routes.ts`): every way through the Auto, one choice at each branching
wait it reaches, ✓ before ✗. Each is timed twice, with every plain wait ✓ and with every plain
wait ✗, and flagged when it runs past 30 s or the endgame guard parks it.

Decisions pick the first row that fires; the
robot drives the chosen paths with the app's own motion profile; the field
highlights the branches taken and dashes the others; a log lists each card,
row and event with its time against the 30 s budget.

Each branch also shows its **worst case**: the Auto's end time if that branch
is taken and every later wait runs to its time row. Over 30 s it is flagged.

The endgame guard is previewed the way `kit.guarded` works on the robot: once
the time left is no more than the park path's exported seconds plus
`AutoKit.GUARD_MARGIN_S` (1 s), a running wait or action stops, the rest of
the branch is skipped and the park path is driven. A path is never cut short:
one the guard let start runs to its end, and the robot parks from there. The
reserve is the exported one, at the drawing's speed, even when the timing
model's measured `driveSpeed` previews the drives faster. Checked against the
robot's first match logs in `test/real-autos.test.ts`. The robot then jumps to the park path's
start in the preview, because a path always starts where the Path List says.

## Share links

Export → **Share Link** makes a link that opens a copy of the project, Auto
included: `…/Visualizer/#data=1.<data>`. It is meant for GitHub issues and
pull requests, so reviewers see the paths next to the Java. It is a
snapshot: git holds the Auto that runs.

- **What it carries.** The `.pp` document exactly as a save writes it (paths,
  shapes, sequence, field points, `robot`, `auto`) and the file name; the
  robot block is what times the preview and the park guard's seconds.
  Display preferences stay the viewer's. Nothing is converted: coordinates
  stay in Pedro's field frame, as in the file.
- **Encoding.** The payload `{name, project}` as JSON, zlib-deflated with
  `CompressionStream`, then base64url. `1` is the link format version. The
  fragment never reaches the server, but a forwarded link carries the whole
  project.
- **Length.** The `hive-rush` sample is about 2,100 characters, over a
  Discord message (2,000), so send the `.pp` file there; an 18-path Auto is
  3,000 to 5,000. GitHub comments take 65,536. The dialog shows the length.
- **Opening one.** The copy is shown with no file open, and the top bar says
  so ("Shared copy" · Save as new file · Close). The viewer's own work and
  recovered session are set aside, not saved over, until **Close**. Save
  (the button, Ctrl+S) asks for a new name, never the open file's. Opening
  another file ends the copy like any file load.
- **Old and broken links.** Format 1 links keep loading; the project inside
  goes through the same normalizers as an old file, and a project from a
  newer build gets the usual warning. A newer link format, a link cut off
  when pasted (the zlib checksum catches it) or one without a project is
  refused with a message saying why. `src/utils/fixtures/hive-rush.v1.link`
  is a frozen format-1 link; its test must keep passing.
- Phones cannot open links: the app shows its phone block page.

Code: `src/utils/shareLink.ts` (encode/decode, no DOM),
`src/lib/session/sharedCopy.ts`, `src/state/links.svelte.ts`,
`ShareLinkDialog.svelte`.

## Sample links

`#sample=<name>` opens `samples/<name>.pp` from the site as a shared copy, the
same way a share link does (`src/utils/sampleLink.ts`). The build copies
`samples/*.pp` to `samples/` on the site (a plugin in `vite.config.ts`, which
also serves them in dev). The link is short, so chat apps do not cut it, and
it always opens the sample as last deployed:
<https://mona-shores-ftc-robotics.github.io/Visualizer/#sample=red-garden-basic>.

## Links to committed Autos

`#gh=` opens an Auto committed in biobuzz's `TeamCode/autos/` as a shared copy.
The link holds only where the file is, so it stays short and always shows what
is in git:

| Link | Opens `TeamCode/autos/red-simple.pp` from |
|---|---|
| `…/Visualizer/#gh=red-simple.pp` | the default branch (`master`), whatever is latest |
| `…/Visualizer/#gh=a1b2c3d/red-simple.pp` | exactly that commit, forever |
| `…/Visualizer/#gh=claude/some-branch/red-simple.pp` | a branch, e.g. a pull request's |

The top bar says which file it is and where its draft stands ("l-quals.pp ·
same as GitHub"). The file is
read from raw.githubusercontent.com: no login while biobuzz is public, and a
branch can be up to 5 minutes stale after a push (a commit never is). A file
that is not there, or GitHub out of reach, is refused with a message saying
which. Code: `src/utils/gitLink.ts`.

## Save to repo folder

**File → Save to repo folder…** writes the Auto straight into the biobuzz checkout on the laptop:
`TeamCode/autos/<name>.pp` and
`TeamCode/src/main/java/org/firstinspires/ftc/teamcode/opmodes/auto/generated/<Class>Auto.java`,
byte for byte what Save to GitHub commits (the same serializer, the same export, the same `SAVED`
stamp). Nothing else in the checkout is touched: no simulation request, no `spots.json`. Then
Sloth Load from Android Studio puts it on the robot. No internet, no file to drop anywhere by hand.

- **The folder is picked once** (Chrome and Edge, through the File System Access API; other
  browsers get a plain message). It must be a biobuzz checkout: the folder that holds `TeamCode`,
  checked by `TeamCode/autos/spots.json` being there. The browser keeps the folder's handle in
  IndexedDB, so later saves only ask to allow access again, from the Save button's click.
- **Open from the folder.** With a folder chosen, the Files panel lists the checkout's
  `TeamCode/autos/*.pp` under "biobuzz checkout", so the team's Autos open from the laptop, not
  from GitHub. One opens like a file from disk: a copy under its own name in this browser, which
  both saves then save back by that name.
- **Offline.** The save and the open need no network. When GitHub cannot be reached, Save to
  GitHub says so and offers this save instead, and the team's spots come from the checkout's
  `spots.json` (`spotsFrom` in `lib/team/spotsStore.ts` says which list is in use).
- **The record afterwards.** The folder save changes two files in the checkout; commit them on
  an `auto/<name>` branch (or do Save to GitHub once online), so master has the Auto the robot
  ran.

Code: `src/lib/repo/repoFolder.ts` (the paths and bytes, on a plain `Folder`, tested without a
browser), `src/lib/repo/repoStore.ts` (the directory handle, its permission and IndexedDB),
`SaveToRepoDialog.svelte`.

## Upstream files touched

New code lives in `src/lib/auto/`, `src/lib/codegen/auto/`, `src/lib/timing/`,
`src/lib/plan/`, `src/lib/ladder/`,
`src/lib/team/`, `src/lib/sim/`, `src/lib/github/`, `src/lib/repo/`, `src/lib/session/`
(`drafts.ts`, `sharedCopy.ts`), the link helpers in `src/utils/`, and three
fork modules in upstream's layout:

- `src/state/auto.svelte.ts` — the open project's Auto, its preview, worst
  case and validation; the ladders, pins and link paths that keep it consistent
  with the paths; card ↔ path selection; adding a path with its card; the plan
  view's state (chapter, open miss, ladder outcome).
- `src/state/links.svelte.ts` — share, sample and `#gh=` links, the shared copy,
  and drafts of files from biobuzz.
- `src/view/ForkDialogs.svelte`, `src/view/forkActions.ts`,
  `src/view/AutoFieldBar.svelte` — the fork's dialogs, menu actions, and the bar
  above the field.

Hook edits to upstream files, each marked "Fork" in a comment:

- `src/io/project.ts` — `ProjectDoc.auto`: read and normalized on load (pins
  adopted for files from before them), written only when present. Undo,
  autosave, overlays and saves carry it from there.
- `src/types.ts`, `src/io/robot.ts`, `src/sim/motionProfile.ts` — `maxVelocity`
  in the robot block, and the profile's cap.
- `src/types.ts`, `src/io/robot.ts`, `src/model/collision.ts`,
  `src/view/FieldPanel.svelte`, `src/lib/components/settings/RobotSettingsSection.svelte`
  — `features` in the robot block (as PathPlanner's robot features): boxes placed from the
  robot's centre (`forward`, `left`, `length`, `width`, `name`, optional `color`), drawn on the robot
  (`RobotFeatures.svelte`, and in the GIF export); those with `collides` count for collisions
  with the drive base (`robotFootprints`). The drive base stays the plain Length x Width box
  centred on the robot. `rForward` (the box that many inches ahead of the centre) is read and
  honoured for older files, and its field shows only when it is set. A file that records no
  features or no `rForward` has none; `prefs` and overlays never carry them from another file.
  Before 2.0.0, `features` sits in the settings block like the rest of the robot.
- `src/utils/timeCalculator.ts`, `src/sim/pose.ts`, `src/types.ts` (`TravelRun`)
  — one motion profile per exported path (see `test/chained-timing.test.ts`).
- `src/state/project.svelte.ts` — `amend()` (pins and link paths adjust the
  document without an undo step) and a `loads` counter.
- `src/state/playback.svelte.ts` — with an Auto the clock and robots follow its
  preview; overlays with an Auto play theirs.
- `src/state/overlays.svelte.ts` — overlays are laid out as their Auto drives them.
- `src/state/editor.svelte.ts` — `addPathHook`: adding a path adds its card.
- `src/state/files.svelte.ts` — `holdAutosave` and `suggestedName` for shared copies; a fresh or
  new project starts with the team robot (`TEAM_ROBOT` in `src/lib/auto/teamRobot.ts`: the wheels,
  15.44 x 16, as the drive base, so a start with the back plate on the wall draws on the wall;
  the FLOWER poker as a feature that collides).
- `src/lib/components/RobotSprite.svelte`, `RobotImagePicker.svelte`, `src/state/gifExport.svelte.ts`
  — the default image ("/robot.png", "Our robot") is our chassis drawn from the drive base's
  numbers (`teamRobotImage`), so a new Length or Width redraws it; `public/robot.png` stays only
  as the fallback. Upstream's plain box is `public/robot-plain.png`, "Plain" in the robot images.
  `RobotSettingsSection.svelte` — "Use our robot" sets the open file to `TEAM_ROBOT`, and the
  feature list.
- `src/lib/simple/` — the simple builder, the left panel's first view: a start (right or left),
  then steps from a palette (Launch all, Drive to a spot, Pick flower, Park), each an ordinary
  card, so files, preview and export are unchanged. A drive's heading turns from the step before
  to its spot's; a click on a FLOWER's line makes a spot on its pick spot (24 in out, square).
  Pick flower is biobuzz's `FlowerPicker`, the robot's one pick routine (D-pad up and the
  PickFlower card); `flowers.ts` holds its numbers. An Auto's pick squares up where the drive
  stopped: when the robot is off the FLOWER's line or not square to it, one short move puts it on
  the line, square, at the distance it stopped (kept between 18 and 24 in from the FLOWER's
  centre); a drive that ends lined up skips it. The preview (`simulate.ts` motions) draws that
  square-up, the stick, the push along the line to 12 in from the FLOWER, the dwell and the
  back-out to where the push started, where it ends. A pick the robot would refuse (not in front of
  the FLOWER, more than 12 in off its line, or more than 30° from square) is marked red, and one that squares
  up is marked so the spot can be moved onto the line. Its card gets an 8 s timeout. Garden gather is biobuzz's `GardenGather` (D-pad down and the GardenGather
  card, on the same sequence as the pick): `garden.ts` holds its numbers, and the preview draws the
  drive in to the nearest GARDEN, turning as a Pedro path does, the dwell and the drive back, its
  time from the distance at the robot's speed caps. `src/state/auto.svelte.ts` — `view` is "simple" for a file of those
  steps (every file in biobuzz `TeamCode/autos`), the plan view otherwise; "← Simple" goes back
  only when the file is simple, and there is no way in from the builder to the card list. `src/state/files.svelte.ts` — a new
  project is `blankAuto`: no paths, at the right start. `src/view/FieldPanel.svelte` — a click
  goes to `spotPicker` while the builder waits for a spot; the inches are `FieldRuler`, outside
  the field; spot names show near the mouse (`fieldHover`). An Auto that lists no commands gets
  our robot's (`teamRegistry`).
- `src/state/dialogs.svelte.ts` — the fork's dialogs.
- `src/model/mirror.ts` — a mirrored project mirrors its Auto's named points.
- `src/view/LayersPanel.svelte` — the card list in place of the path tree.
- `src/view/FieldPanel.svelte`, `src/view/scene/PathMarkers.svelte`,
  `src/view/scene/PathStrokes.svelte` — the Auto overlay and field axes; path
  strokes stay clickable but hidden (the overlay draws them by branch); link
  paths hidden; control points only for the selected card's path; Shift-drag.
- `src/view/PlaybackBar.svelte` — the preview's decisions and events, and the 30 s budget.
- `src/view/TopBar.svelte`, `src/view/actions.ts`, `src/view/AppDialogs.svelte`,
  `src/App.svelte` — the fork's name, menus, status and wiring.
- `src/view/snap.ts` — `lockToAxis` for Shift-drag.
- `src/utils/filename.ts` — saves `.pp`.
- `src/lib/panels/panelLayout.ts` — the left panel's minimum width.
- Asset paths go through `publicAsset()` (the site is served from `/Visualizer/`):
  `FieldMapImage`, `FieldLoadingOverlay`, `RobotImagePicker`, `TopBar`, `gifExport`.
- `public/sw.js`, `src/main.ts`, `index.html` — network-first offline copy,
  relative paths, the fork's title.
- `vite.config.ts` — publishes `samples/*.pp` for sample links; vitest also runs
  `src/**/*.test.ts`.
- `test/io.test.ts` — expects `maxVelocity` in the robot block.
