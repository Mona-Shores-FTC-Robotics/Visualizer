# Where this simulator comes from

`sim/` is the BIOBUZZ simulator by the students and mentors of NCSSM FTC teams 5064, 8569 and 22377
(github.com/teddytennant/ftc-biobuzz-sim, MIT, `LICENSE` and `NOTICE.md` here), taken unchanged at upstream commit
`3c22f76` (16 Nov 2026). Mona Shores adopted it on 23 Nov 2026 as the base of our match and drill simulator: its
engine (drive, motors, traction, contact, four robots, the full 2:30, the PIN referee, the three.js view) stays, and
our measured models replace its models where we have data, each change citing its number.

- Physics and robot models (`src/sim/**`, the robot file): the biobuzz simulator chat.
- Controls, drills and the multi-robot screen: the Visualizer drill chat.
- `CLAUDE.md` in this folder is upstream's and still applies to work in here.
- Upstream's Cloudflare parts (`functions/`, `server/`, `migrations/`, `wrangler.toml`, the match counter) are
  unused by us and left as they came, so a diff against upstream stays clean.
- `.github/workflows/ci.yml`'s `sim` job runs its type check and tests on every push.
