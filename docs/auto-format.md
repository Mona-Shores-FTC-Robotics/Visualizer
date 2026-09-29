# The `auto` section of a `.pp` file

This fork of the Pedro Pathing Visualizer adds an **Auto mode**: the Path List
becomes a whole 30-second Autonomous made of cards (actions, waits, decisions
with branches, path cards with while-driving actions and events, an endgame
guard), previewed on the field and exported as Java for the robot's `autokit`
library.

A `.pp` file stays a normal Visualizer 1.5.0 file plus **one** new top-level
key, `auto`. Everything the Auto builder adds lives under it, so:

- the stock Visualizer opens our files (it ignores `auto`), and
- a project without an Auto is written exactly as before (no `auto` key).

## Using Auto mode

- **Auto** in the top bar swaps the Path List for the Auto's card list and the
  Controls panel for the Auto panel (the first time, it adds an empty `auto`
  section). Paths are still drawn and edited on the field as usual.
- **+ Action / + Wait for / + Decision / + Path / + Routine / + Go to /
  + Together** add a card after the selected
  card; select a decision's branch header to add at the end of that branch.
  The selected card has ↑ ↓ ✕ in the list and Duplicate / Delete in the panel.
- The panel edits the selected card: the action; a path card's path,
  while-driving chips, events bar (click to add, drag to move, arrow keys to
  nudge) and park checkbox; a wait's or decision's rows; a routine's placement,
  with a fit check against the walls and keep-out zones, and the **routine
  editor** (steps table, a pattern canvas whose points drag, end condition,
  timeout, while and exit actions).
- **Robot actions & conditions** is the registry, plus the alliance the Auto
  is drawn for, the export name and the named points.
- **Preview as** sets the scenario; the playback bar, robot and log follow it.
  Untaken branches are dashed on the field and dimmed in the list.
- **Export .java** (or Export → Export Auto (Java)) downloads the class.

## Shape

```json
"auto": {
  "version": 1,
  "drawnFor": "BLUE",
  "exportName": "hive-rush",
  "registry": { "actions": ["ShootAll", "SpinUp"], "conditions": ["LauncherReady", "HiveTipped"] },
  "points": { "ShootSpot": [38, 71], "UpCellShot": [108, 84, 45] },
  "cards": [
    { "id": "c1", "kind": "action", "name": "SpinUp" },
    { "id": "c2", "kind": "firstOf", "label": "Wait for LauncherReady",
      "rows": [ { "when": ["LauncherReady"], "cards": [] }, { "afterMs": 800, "cards": [] } ] },
    { "id": "c3", "kind": "path", "lineId": "<top-level path id>", "while": ["SpinDown"],
      "events": [ { "at": 0.6, "action": "IntakeOn" } ], "park": false },
    { "id": "c4", "kind": "firstOf", "label": "Did the HIVE tip?",
      "rows": [ { "when": ["HiveTipped", "CameraBlind"], "label": "If tipped", "cards": [ ... ] },
                { "afterMs": 1500, "label": "If not tipped", "cards": [ ... ] } ] }
  ]
}
```

A complete example that uses every card and row kind is
`src/lib/auto/fixtures/hive-rush.pp`; its exported Java is the golden file
`src/lib/codegen/auto/fixtures/HiveRushAuto.java`.

### Top level

| Key | Type | Meaning |
|---|---|---|
| `version` | `1` | Format version. A newer version loads with a warning. |
| `drawnFor` | `"RED"` \| `"BLUE"` | The alliance the Auto is drawn for. The robot mirrors it for the other alliance (`PoseFactory.mirrorX(70.75)`). |
| `exportName` | string, optional | Name of the generated class before the `Auto` suffix. Defaults to the file name (`hive-rush.pp` → `HiveRushAuto`). |
| `registry.actions` | string[] | Robot actions the robot code registers. The editor cannot read robot code, so the file carries the list; dropdowns offer only these. |
| `registry.conditions` | string[] | Registered true/false conditions, likewise. |
| `points` | `{ name: [x, y] \| [x, y, headingDeg] }` | Named points (inches, Pedro field frame). Exported as named `Pose` locals; a path endpoint that sits on a named point uses its name. |
| `cards` | card[] | The Auto, top to bottom (the "trunk"). |

### Cards

Every card has a unique `id` (the editor addresses cards by it) and a `kind`.

| `kind` | Fields | Meaning |
|---|---|---|
| `action` | `name`, `previewMs?` | Runs a registered action. `previewMs` is only used by the preview (how long the action keeps the robot busy); it is not exported. |
| `path` | `lineId`, `while`, `events`, `park` | Drives an existing path. `lineId` is the id of a **top-level** entry in the Path List (a path, or a group, which Pedro follows as one path). `while`: actions started with the path. `events`: `{at, action}` with `at` in 0..1 of the path's length. `park`: this is the branch's park path for the endgame guard. |
| `firstOf` | `label`, `rows` | Waits for the first true row, then runs that row's cards; the cards after it continue once they are done. With no cards on any row it is a **Wait for** card; otherwise it is a **decision**. |
| `routine` | `routine`, `at`, `facingDeg`, `mirror`, `exit` | Runs the named routine (see below) placed at the named point `at`, facing `facingDeg`, optionally mirrored left↔right; then drives straight to the named point `exit`. |
| `goTo` | `label`, `point`, `maxDistanceIn`, `ifRefused` | Drives straight to the named point if it is at most `maxDistanceIn` away; otherwise runs the `ifRefused` cards. |
| `together` | `label`, `ends`, `cards` | Starts its cards at once; done when `"ALL"` of them are, or the `"FIRST"` one is. Only one of them should drive. |

### Routines

`routines` (optional; written only when there are some) maps a name to a
pattern defined **relative to where it starts**, so one routine can be placed
at several points:

```json
"routines": {
  "CollectFar": {
    "steps": [ { "forward": 12, "left": 0 }, { "forward": 12, "left": -16, "control": [18, -8] } ],
    "endsWhen": "IntakeFull", "timeoutMs": 2500,
    "while": ["IntakeOn"], "exit": ["IntakeOff", "SpinUp"]
  }
}
```

`steps` follow the implicit start at (0, 0): `forward` along the facing, `left`
to the robot's left, in inches; a step with `control` is a curve through that
control point. The heading is held at the facing for the whole pattern. The
routine ends when `endsWhen` (a registered condition) turns true, after
`timeoutMs`, or when the pattern is done; `while` actions run during it and
`exit` actions as it leaves for the card's exit point.

### Rows

Each row has exactly one condition key, plus `cards` (possibly empty) and an
optional `label` (the branch's name; defaults to one made from the condition).

| Row | Becomes true |
|---|---|
| `{"when": ["A", "B"]}` | when any of the registered conditions is true (OR) |
| `{"afterMs": 800}` | 800 ms after the card started |
| `{"timeLeftBelowS": 5}` | when less than 5 s of the 30 s Auto remain |
| `{"otherwise": true}` | at once (= `afterMs: 0`): the "else" of an if |
| `{"nearPoint": "ShootSpot", "radiusIn": 6}` | when the robot is within 6 in of the named point |
| `{"inArea": ["CornerA", "CornerB"]}` | when the robot is inside the axis-aligned box with those named corners |

Rules the editor enforces (errors block the Java export):

- every `firstOf` has at least one **time row** (`afterMs`, `timeLeftBelowS`
  or `otherwise`), so nothing can wait forever;
- every action and condition name used anywhere is in the registry;
- a path card names a top-level path that exists;
- a list of cards has at most one park card, and a `together` holds none;
- a routine card names a defined routine with steps and a registered
  `endsWhen`, and its start and exit points exist; a `goTo` names a point.

Warnings (shown, not blocking): a path that starts more than 2 in from where
the robot can be when it starts; a park card that is not last in its branch;
rows that can never fire because an earlier `otherwise` always wins; a
branch whose worst case runs past 30 s.

### Loading

`normalizeAuto` (`src/lib/auto/normalize.ts`) never throws. It keeps what it
can, re-issues missing or duplicate ids, sorts events by `at`, and returns a
list of plain-English problems for anything it dropped (unknown card kinds,
rows with zero or two conditions, malformed points, …); the app shows them as
a toast. `serializeAuto` writes keys in a fixed order, so saving twice gives
the same bytes.

### Geometry

A path card uses exactly the geometry the stock Visualizer draws and exports:
a path starts where the previous path **in the Path List** ends. So two
branches that both leave the same spot need the Path List to reach that spot
before each of them; the discontinuity warning says when a card would start
somewhere the robot is not.

## Generated Java

"Export Auto (Java)" writes `<ExportName>Auto.java` in package
`org.firstinspires.ftc.teamcode.opmodes.auto.generated`, following the
contract with the robot's `autokit` library:

- `SOURCE`, `ACTIONS`, `CONDITIONS` (every registered name used, sorted, no
  duplicates), `DRAWN_FOR`, `startPose(boolean mirrored)`, a private
  `poses(boolean mirrored)` factory and `build(AutoKit kit, boolean mirrored)`;
- every pose is a `Pose` local built with `p.of(...)` so mirroring applies to
  all of them; named points first, then the other poses the paths need;
- shapes become `kit.keepOut(...)` with their corners in order;
- paths are `Path` locals using the same expressions as the stock export
  (`Paths.line/curve/through/path` plus a heading suffix); `Interpolator` is
  imported only when a piecewise heading is used;
- the cards become one `kit.sequence(...)`; a `firstOf` becomes
  `kit.firstOf(label, rows...)`; a row with cards is `kit.when(...).then(...)`;
- a routine card becomes `kit.routine(label, pattern, endsWhen, timeoutMs,
  while[], exit[], exitPose)`, where `pattern` is a `Path` local placed on the
  field (`Paths.line/curve(...).constant(start)`, joined with `Paths.path`),
  and the label is `"<routine> at <point>"`;
- a `goTo` becomes `kit.goTo(label, point, maxDistanceIn, ifRefused)`, where
  `ifRefused` is the one card, or `kit.sequence(...)` of several;
- a `together` becomes `kit.together(label, AutoKit.Ends.ALL|FIRST, cards...)`;
- a list that directly contains a park card is wrapped
  `kit.guarded(label, parkPath, seconds, cards...)`, where `seconds` is the
  park path's drive time by the preview's motion model, rounded **up** to
  0.1 s; the trunk's guard label is `"Auto"`, a branch's is its row label.

### Robot settings belong to the file

The preview's timing and the park guard's `seconds` come from the robot size
and motion model (`xVelocity`, `yVelocity`, `aVelocity`, `kFriction`,
`rWidth`, `rHeight`, `safetyMargin`, `maxVelocity`, `maxAcceleration`,
`maxDeceleration`), so every file carries its own under `settings`:

- opening a file applies its values, and the **defaults** for any it lacks;
  the viewer's own values are never used for a file, so the same file exports
  the same Java whoever opens it, in the app or with `export-auto.mjs`
  (`settingsForFile` in `src/utils/project.ts`; a test checks the two agree);
- editing them in Settings changes the open file, and every save writes them;
- a new file starts with the values in use when it is made;
- display preferences (panels, colours, images, the field image) stay the
  viewer's and do not change when a file is opened.

From the command line, without opening the app:

```
node scripts/export-auto.mjs path/to/hive-rush.pp [outDir]
```

`npm test` runs the unit tests, including a golden test that exports the
sample and compares it with `HiveRushAuto.java` line by line. That golden file
compiles with `javac --release 8` against Pedro 3.0.1, Ivy and the contract's
`autokit` signatures, and its `build()` runs for both alliances.

## Preview

The preview runs the card tree against a **scenario**: for each registered
condition, whether it becomes true and when (N s after the waiting card
starts, or N s into the Auto). Decisions pick the first row that fires; the
robot drives the chosen paths with the app's own motion profile; the field
highlights the branches taken and dashes the others; a log lists each card,
row and event with its time against the 30 s budget.

Each branch also shows its **worst case**: the Auto's end time if that branch
is taken and every later wait runs to its time row. Over 30 s it is flagged.

Routines run their placed pattern until the condition (from the scenario),
the timeout or the pattern's end, then drive straight to the exit point. A
`goTo` drives straight to its point or runs its fallback. A `together` follows
the card that drives and counts the others' time; with `FIRST` it stops at
the first card's end.

The endgame guard is previewed the way `kit.guarded` is meant to work: once
the time left is no more than the park path's seconds, whatever is running
(a wait, an action, a path part-way) stops, the rest of the branch is
skipped and the park path is driven. The robot then jumps to the park path's
start in the preview, because a path always starts where the Path List says.

## Share links

Export → **Share Link** makes a link that opens a copy of the project, Auto
included: `…/Visualizer/#data=1.<data>`. It is meant for GitHub issues and
pull requests, so reviewers see the paths next to the Java. It is a
snapshot: git holds the Auto that runs.

- **What it carries.** The `.pp` document exactly as a save writes it (paths,
  shapes, sequence, field points, `auto`), the file name, and only the
  settings that change what the Auto means: robot size and the motion model
  (they time the preview and the park guard's seconds).
  Display preferences stay the viewer's. Nothing is converted: coordinates
  stay in Pedro's field frame, as in the file.
- **Encoding.** The payload `{name, project}` as JSON, zlib-deflated with
  `CompressionStream`, then base64url. `1` is the link format version. The
  fragment never reaches the server, but a forwarded link carries the whole
  project.
- **Length.** The `hive-rush` sample is about 2,100 characters, over a
  Discord message (2,000), so send the `.pp` file there; an 18-path Auto is
  3,000 to 5,000. GitHub comments take 65,536. The dialog shows the length.
- **Opening one.** The copy is shown with a banner and no file open. The
  viewer's own work, recovered session and saved settings are set aside, not
  saved over, until **Close and return to my work**. Save (the button,
  Ctrl+S, Save As) writes a new file, never the one that was open. Opening
  another file ends the copy like any file load.
- **Old and broken links.** Format 1 links keep loading; the project inside
  goes through the same normalizers as an old file, and a project from a
  newer build gets the usual warning. A newer link format, a link cut off
  when pasted (the zlib checksum catches it) or one without a project is
  refused with a message saying why. `src/utils/fixtures/hive-rush.v1.link`
  is a frozen format-1 link; its test must keep passing.
- Phones cannot open links: the app shows its phone block page.

Code: `src/utils/shareLink.ts` (encode/decode, no DOM),
`src/lib/session/sharedCopy.ts`, `ShareLinkDialog.svelte`,
`SharedCopyBanner.svelte`.

## Upstream files touched

New code lives in `src/lib/auto/`, `src/lib/codegen/auto/`,
`src/lib/testing/` and `scripts/run-tests.mjs`. Hook edits to upstream files:

- `src/utils/project.ts` — `ProjectDoc.auto`; `buildProject` writes it only when present.
- `src/utils/history.ts` — `AppState.auto`, so undo/redo cover the Auto; `reset()`
  for opening and closing a shared copy.
- `src/lib/session/sessionSnapshot.ts` — the recovery snapshot carries `auto`.
- `src/App.svelte` — load, save, undo/redo, session recovery; opening a share
  link as a shared copy (session and settings are not persisted while it is shown,
  and saves go to a new file).
- `src/lib/FileManager.svelte` — load, save, new file, mirror.
- `src/lib/codegen/identifiers.ts` — exports `isReservedWord`.
- `src/utils/timeCalculator.ts` — exports `calculateMotionProfileTime`, so routine
  patterns and straight drives are timed on the same profile as paths.
- `src/lib/Navbar.svelte` — the Auto toggle; "Export Auto (Java)" in the export menu;
  the time readout shows the preview's length in Auto mode; reset clears the Auto;
  "Share Link" in the export menu.
- `src/lib/components/LeftRail.svelte` — optional `listOverride` snippet, shown in
  place of the Path List (Auto mode's card list).
- `src/App.svelte` also: in Auto mode the playback bar and robot follow the preview's
  timeline (and its routine/straight drives), the stock path strokes are hidden (the
  overlay draws them by branch), and the Controls panel shows the Auto panel instead
  of `ControlTab`.
- `package.json` — `test` script.
