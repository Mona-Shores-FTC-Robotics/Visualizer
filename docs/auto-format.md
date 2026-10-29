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

### Cards

Every card has a unique `id` (the editor addresses cards by it) and a `kind`.

| `kind` | Fields | Meaning |
|---|---|---|
| `action` | `name`, `timeoutS?`, `previewMs?` | Runs a registered **command** (the editor calls it that; the file keeps the key `action`). On the robot it runs until it finishes or `timeoutS` (default 5 s), exported as `kit.command(name[, timeoutS])`. The preview uses the command's typical time from `registry.typicalS`, else `previewMs` (older files), else instant, never past the timeout. |
| `path` | `lineId`, `park`, `through`? | Drives an existing path. `through`: the robot drives through this path's end without stopping, so it and the paths after it (up to the first without `through`) are one drive, exported as one Pedro path. `lineId` is the id of a **top-level** entry in the Path List (a path, or a group, which Pedro follows as one path). `park`: this is the branch's park path for the endgame guard. Nothing runs while it drives. |
| `firstOf` | `label`, `rows`, `alongside`?, `ladder`? | **Wait for a trigger, at most a time**: exactly one `when` row and one `afterMs` row. With no cards on either row it is a plain **Wait for**; with cards each row holds the rest of its route (a **decision**). `alongside` names a command run *while* it waits ("LaunchAll · wait for Tip"): it starts with the wait and is stopped when a row fires, if still running. |

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

Rules the editor enforces (errors block the Java export):

- every `firstOf` has exactly one trigger row and one time row, so nothing can wait forever;
- every action and condition name used anywhere is in the registry;
- a path card names a top-level path that exists;
- a list of cards has at most one park card.

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

- `SOURCE`, `COMMANDS`, `TRIGGERS` (every registered name used, sorted, no
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
  0.1 s; the trunk's guard label is `"Auto"`, a branch's is its row label.

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
```

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

## Upstream files touched

New code lives in `src/lib/auto/`, `src/lib/codegen/auto/`, `src/lib/timing/`,
`src/lib/plan/`, `src/lib/ladder/`,
`src/lib/team/`, `src/lib/sim/`, `src/lib/github/`, `src/lib/session/`
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
  — `rForward` in the robot block: the box (drawing and collision footprint) sits that many
  inches ahead of the robot's centre, for a robot that reaches further forward than back.
- `src/utils/timeCalculator.ts`, `src/sim/pose.ts`, `src/types.ts` (`TravelRun`)
  — one motion profile per exported path (see `test/chained-timing.test.ts`).
- `src/state/project.svelte.ts` — `amend()` (pins and link paths adjust the
  document without an undo step) and a `loads` counter.
- `src/state/playback.svelte.ts` — with an Auto the clock and robots follow its
  preview; overlays with an Auto play theirs.
- `src/state/overlays.svelte.ts` — overlays are laid out as their Auto drives them.
- `src/state/editor.svelte.ts` — `addPathHook`: adding a path adds its card.
- `src/state/files.svelte.ts` — `holdAutosave` and `suggestedName` for shared copies; a fresh or
  new project starts with the team robot's box (`src/lib/auto/teamRobot.ts`).
- `src/lib/components/RobotSprite.svelte`, `RobotImagePicker.svelte`, `src/state/gifExport.svelte.ts`
  — the default image ("/robot.png", "Our robot") is drawn from the box's numbers
  (`teamRobotImage`), so a new Length, Width or "Box ahead of centre" redraws it;
  `public/robot.png` stays only as the fallback. Upstream's plain box is `public/robot-plain.png`,
  "Plain" in the robot images. `RobotSettingsSection.svelte` — "Use our robot" sets the open
  file to `TEAM_ROBOT_BOX`. `src/io/robot.ts` — a file that records no `rForward` keeps a centred
  box.
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
