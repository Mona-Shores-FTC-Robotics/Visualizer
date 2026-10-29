# Pedro Pathing Visualizer: BIOBUZZ Auto Builder fork

This is a fork of the [Pedro Pathing Visualizer](https://github.com/Pedro-Pathing/Visualizer)
(Apache-2.0), maintained by Mona Shores FTC (teams 19429 and 20245). It is not the official
Visualizer and is not endorsed by Pedro Pathing.

**Use it:** <https://mona-shores-ftc-robotics.github.io/Visualizer/>

What the fork adds:

- **Auto mode.** The Auto button in the top bar turns the Path List into the whole Autonomous:
  actions, waits, decisions with branches ("wait for the first of these rows"), path cards with
  while-driving actions and events along the path, routines, go-to, "together", and an endgame
  guard. "Preview as" plays any scenario against the 30 s budget.
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

- **Save to GitHub and simulate.** The cloud button in the top bar commits the project to biobuzz
  (the `.pp`, its exported Java and a simulation request, one commit, never on `master`). biobuzz's
  "Simulate Auto" workflow runs it in the Java simulator; the dialog shows each seed's points, TIPs
  and LEAVE/PARK and has **Download WPILOG** for AdvantageScope. Links may name any `.pp` in biobuzz
  by its whole path (`#gh=<branch>/TeamCode/…/x.pp`), and a save goes back to that file. Seeing
  results needs nothing; saving needs a fine-grained GitHub token, kept in the browser.

Built on upstream **v2.5** (merged 2026-10-28). The fork's code sits in its own folders, and the
hooks it needs in upstream's files are listed in
[`docs/auto-format.md`](docs/auto-format.md#upstream-files-touched).

`main` is deployed to GitHub Pages on every push (`.github/workflows/pages.yml`). Upstream changes
are merged in between competitions, not during one. With [pnpm](https://pnpm.io):
`pnpm install`, then `pnpm dev`; `pnpm test` (unit), `pnpm test:e2e` (browser), `pnpm check` and
`pnpm lint` are what CI runs (`.github/workflows/ci.yml`).
