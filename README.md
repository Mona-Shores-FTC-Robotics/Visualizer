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
  Launch all, Drive to a spot, Pick flower, Garden gather, Spin up, Wait (for TIP or CELL up, or
  intake full, at most N s, with an Otherwise list for when it doesn't come, which may hold a Wait
  with an Otherwise of its own) and Park. Each step is
  an ordinary card, so the file, the preview and the Java export are the same as for any Auto.
  Every Auto and partner stand-in in biobuzz opens here. Save, Share and Export are in the top bar.
- **The plan view and the card list.** A file the builder can't read as steps (several triggers
  racing, a ladder, a command beside a wait) opens in the plan view instead: the good path in TIP
  chapters, a ◆ on the field for each wait that branches, **All outcomes**, and **Edit as cards**
  for every card the engine supports. Waits on a condition the robot registers but cannot sense
  yet (biobuzz `AutoRegistration.PLACEHOLDERS`) say "timed on the robot for now".
- **Ladders.** A miss is a ladder of tries, then park: "if TIP 1 doesn't come, refill at the wall
  FLOWER and shoot again; then the GARDEN; then park". Tries are shared plays picked from a
  short BIOBUZZ list, and three fixed rules finish every route (a try that works goes back to the
  plan, a source is used once, every route ends at the park). The ladder is built into ordinary
  cards, so the robot runs it with no new code. See
  [`docs/auto-format.md`](docs/auto-format.md#ladders).
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
