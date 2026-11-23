# Pedro Pathing Visualizer: BIOBUZZ Auto Builder fork

This is a fork of the [Pedro Pathing Visualizer](https://github.com/Pedro-Pathing/Visualizer)
(Apache-2.0), maintained by Mona Shores FTC (teams 19429 and 20245). It is not the official
Visualizer and is not endorsed by Pedro Pathing.

**Use it:** <https://mona-shores-ftc-robotics.github.io/Visualizer/>

What the fork adds:

- **Local event workspace.** Open **Workspace**, connect the BIOBUZZ checkout on your event
  branch (for example Belding), and open an auto with a partner from that same checkout.
  Save/Ctrl+S writes its `.pp` and Java directly, without GitHub or CI. The header identifies
  the checkout and save status; tested checkpoints preserve and restore related auto files.
  See [Working on Belding autos](docs/local-workspace.md) for the workflow and limits.

- **The Auto Builder** (what opens). An Auto as a short list of our robot's steps: a start, then
  Launch all, Drive to a spot, Pick flower, Pick flower and launch, Garden gather, Spin up, Wait (for TIP or CELL up, or
  intake full, at most N s, with an Otherwise list for when it doesn't come, which may hold a Wait
  with an Otherwise of its own) and Park. Each step is
  an ordinary card, so the file, the preview and the Java export are the same as for any Auto.
  Every Auto and partner stand-in in biobuzz opens here. Save, Share and Export are in the top bar.
- **One editor.** The builder opens every file. A command it has no step of its own for shows by
  its name with its time limit, and a wait shows whatever trigger it waits for. A card it cannot
  read as a step (an older file's command beside a wait, a `rejoin`) is listed as "not a builder
  step": it can be moved or removed, and the file, the preview and the export keep it as it is.
- **Tested against real data.** `test/real-autos.test.ts` reads the team's six Autos, the
  simulator's runs of two of them and robot 20245's first match logs (refresh with
  `node scripts/refresh-biobuzz-fixtures.mjs ../biobuzz`), and fails when the preview drifts out
  of the ballpark: drive times, card start times, the endgame guard, parking by 30 s.
- **Export Auto (Java).** Writes a class for the `autokit` library in the robot code. The format of
  the `auto` section of `.pp` files is in [`docs/auto-format.md`](docs/auto-format.md); the stock
  Visualizer still opens these files and ignores that section.
- **Share links.** Export → Share Link makes a link that opens a copy of the project, Auto
  included, for GitHub issues and pull requests. It is a snapshot, not the version in git; see
  [`docs/auto-format.md`](docs/auto-format.md#share-links).
- **One motion per exported path**, meant to be offered upstream: a group is followed as one
  Pedro path, so the preview times it as one profile instead of stopping at every joint. (The
  fork's other two preview fixes, placing the robot by distance and drawing "through" curves the
  way Pedro 3 follows them, are in upstream since v2.5.)
- **A robot speed cap.** `maxVelocity` in a file's robot block caps the motion profile; upstream
  uses the average of the forward and strafe velocities.

- **Save to GitHub and simulate.** Save → Save to GitHub and simulate in the top bar commits the project to biobuzz
  (the `.pp`, its exported Java and a simulation request, one commit, never on `master`). The
  request names the Auto and stamps each log; the robot design, seeds and alliance are the
  request's own (the real robot, ten seeds, RED when it has none): nothing to choose, a student
  presses Save. Who the Auto runs beside comes from biobuzz: the Auto's
  `TeamCode/sim-requests/<name>.json` lists its `partners` (a mentor's curation, with
  `partnerSeeds`), a save carries them and every other key through unchanged, and the dialog says
  "Will simulate: alone; …" before the button. biobuzz's "Simulate Auto" workflow runs them in the
  Java simulator; the dialog shows one row per entry of the result (the Auto alone, then each
  partner at each timing: mean points, TIPs, how the wait ended, collisions, parking, best and
  typical logs), and a row opens into its seeds for AdvantageScope. A result from before
  `entries` shows as the Auto alone, as it did. Links may name any `.pp` in biobuzz by its whole
  path (`#gh=<branch>/TeamCode/…/x.pp`), and a save goes back to that file. Seeing results needs
  nothing; saving needs a fine-grained GitHub token, kept in the browser.
- **The partner wait.** A wait card can be marked as the partner wait (one per Auto): the drive
  team enters when the partner's last preload leaves, and the robot sets that wait's time limit
  from it. The export writes its time row as `kit.afterMs(kit.partnerWaitMs(<default ms>))`.
  See [`docs/auto-format.md`](docs/auto-format.md).
- **Partner stand-ins in Team Autos.** Under the Autos, `TeamCode/autos/partners/` is listed on
  its own; tick a stand-in beside an Auto to draw it as an overlay. It is never the project
  that opens.
- **Auto Match Planning** (`partner.html`, linked from the Auto Strategy page). A phone page for
  the pits, in the order the conversation goes: the match (our events and matches from
  FTCScout, or before the schedule the event's team list), then **their Auto**, then **ours** on
  top of it.
  - Their Auto is picked by picture: the team's saved Autos first, then the page's stand-ins
    (`src/partner/route.ts`). Then it is adjusted: spots and one bend per drive dragged on the
    field; shot times ("we shoot at 5"; the volley, 3.5 s unless they say, runs to the last ball
    leaving, and the page shows when the CELL settles); "parked by" times; "they wait".
  - Our Auto comes with its INIT choices and INIT wait. The two run together with the preview
    and the Match view's contact check, answered in four tiles: contact, where each parks, TIPs.
    When they touch, the page offers the smallest delay (theirs, or our INIT wait) that avoids it.
  - A plan holds options (A, B, …: their Auto beside ours) to flip between, one starred as the
    one the team goes with. Plans are on biobuzz's `scouting` branch
    (`scouting/<season>/<event>.json`, and `scouting/<season>/partners.json` for each team's
    known Autos, which a plan's named partner Autos join): anyone can read them; saving takes
    the GitHub token Save to GitHub uses. A quick look, not the Java simulator.
- **Driver Drill** (`drill/`, <https://mona-shores-ftc-robotics.github.io/Visualizer/drill/>). Driver
  practice on a laptop with a PlayStation controller: a 2:00 TeleOp toward 7 TIPs, solo or as an
  alliance (Ultraviolet and Infrared on one field, a controller each), with the robot's practice
  readout (each pick-up, each cycle and its split, as on the Driver Station) and the best runs kept in
  the browser. Solo, gamepad 1 is the driver and gamepad 2 the operator (or driver only).
  The buttons are the robot's: read from biobuzz's controls export
  (`TeamCode/cheat-sheets/controls.json`, written by `CheatSheetTest`), never typed in here. The
  robot numbers per team (speed, acceleration, FLOWER and GARDEN times, volley) come from the
  simulator's robot file, `sim/src/sim/robots/mona-shores.json`, sourced to the Fruitport and Belding
  logs. The physics, field and HIVE are the simulator in `sim/`,
  [ftc-biobuzz-sim](https://github.com/teddytennant/ftc-biobuzz-sim) (MIT, by Carl Ryden and NCSSM
  FTC), with its TIP timing selectable (ours from the films, or theirs).
- **Drafts in Team Autos.** `TeamCode/autos/drafts/` (Autos of ours the robot does not run yet) is
  listed too, and a link may name one: `#team=master/drafts/r-solo-push.pp,partners/partner-push-start.pp`.
  A draft opens and saves like any Auto: Save to GitHub suggests its own `drafts/` path, and Save to
  repo folder takes `drafts/<name>.pp`.
- **Save to repo folder.** The same two files, written straight into the biobuzz checkout on the
  laptop (Chrome or Edge; the folder is picked once), then Sloth Load. For an event: no internet,
  nothing to drop into `generated/` by hand. With a folder chosen the Files panel opens the
  checkout's Autos, and the team's spots come from it when GitHub is out of reach. See
  [`docs/auto-format.md`](docs/auto-format.md#save-to-repo-folder).

Built on upstream **v2.5** (merged 2026-10-28). The fork's code sits in its own folders, and the
hooks it needs in upstream's files are listed in
[`docs/auto-format.md`](docs/auto-format.md#upstream-files-touched).

`main` is deployed to GitHub Pages on every push (`.github/workflows/pages.yml`). Upstream changes
are merged in between competitions, not during one. With [pnpm](https://pnpm.io):
`pnpm install`, then `pnpm dev`; `pnpm test` (unit), `pnpm test:e2e` (browser), `pnpm check` and
`pnpm lint` are what CI runs (`.github/workflows/ci.yml`).
