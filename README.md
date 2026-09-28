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
- **Preview fixes**, meant to be offered upstream: each exported path is timed as one motion
  (the robot no longer stops at every sub-path), the robot is placed by distance travelled, and
  "through" curves are drawn the way Pedro 3 follows them.

`main` is deployed to GitHub Pages on every push (`.github/workflows/pages.yml`). Upstream changes
are merged in between competitions, not during one. `npm test` runs the tests.
