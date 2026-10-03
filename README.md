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

## Run in simulator (on a laptop)

With a biobuzz checkout beside this one (or `BIOBUZZ_DIR` pointing at it), `npm run dev` adds a
**Simulator** button (▶) to the top bar. It opens `.pp` files straight from biobuzz's
`TeamCode/autos/` and `TeamCode/src/test/resources/auto-builder/`, and **Run in simulator** saves
the project back there, exports its Java over the generated class that names it, and runs
biobuzz's `SimRunTest` with Gradle: the Auto (and a partner Auto, if chosen) on one robot design
over several seeds. It shows points, TIP times, LEAVE/PARK and problems per seed, with each
seed's `.wpilog` for AdvantageScope. The biobuzz branch must have `SimRunTest`; the first run
builds TeamCode and takes minutes, later ones seconds. The hosted site has no button: it cannot
reach a checkout. The files it writes are ordinary changes in biobuzz, committed as usual.

`main` is deployed to GitHub Pages on every push (`.github/workflows/pages.yml`). Upstream changes
are merged in between competitions, not during one. `npm test` runs the tests.
