// Copies the real Autos and the simulator's results from a biobuzz checkout into
// test/fixtures/biobuzz/, for the tests that check the editor against real data.
//   node scripts/refresh-biobuzz-fixtures.mjs ../biobuzz
// Needs the checkout's `master`, `sim-results` and `claude/simulator` branches fetched.
// test/fixtures/biobuzz/real/2026-10-25.json is not copied: it is written by hand from
// doc/real-vs-sim-25-oct.md on claude/simulator (the robot's logs are on the team's Drive).
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const repo = process.argv[2];
if (!repo) {
  console.error("usage: node scripts/refresh-biobuzz-fixtures.mjs <biobuzz checkout>");
  process.exit(2);
}
const git = (...args) => execFileSync("git", ["-C", repo, ...args], { encoding: "utf8", maxBuffer: 1 << 28 });
const out = "test/fixtures/biobuzz";
mkdirSync(join(out, "autos"), { recursive: true });
mkdirSync(join(out, "sim"), { recursive: true });

const master = git("rev-parse", "--short", "origin/master").trim();
const autos = git("ls-tree", "--name-only", "origin/master", "TeamCode/autos/")
  .split("\n")
  .filter((path) => path.endsWith(".pp"));
for (const path of autos) {
  writeFileSync(join(out, "autos", path.split("/").pop()), git("show", `origin/master:${path}`));
}

/** Seconds from a timeline line's start to the next step of the robot's own Auto. */
const STEP = /^\s*([\d.]+) (path|wait|command) (.*?)(?: \(holds \d+\))?$/;
const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
const round = (value) => Math.round(value * 100) / 100;

for (const auto of ["l-quals", "r-quals"]) {
  const result = JSON.parse(git("show", `origin/sim-results:${auto}/latest.json`));
  const pp = git("show", `${result.commit}:${result.pp}`);
  writeFileSync(join(out, "sim", `${auto}.pp`), pp);
  const drives = {};
  const tips = [];
  const finished = [];
  for (const run of result.runs ?? []) {
    run.tipsAt.forEach((at, i) => (tips[i] ??= []).push(at));
    const robot = run.robots.find((r) => r.auto === auto);
    if (robot.park && typeof robot.finishedAt === "number") finished.push(robot.finishedAt);
    const steps = robot.timeline.map((line) => STEP.exec(line)).filter(Boolean);
    steps.forEach((m, i) => {
      if (m[2] !== "path" || !steps[i + 1]) return;
      (drives[m[3]] ??= []).push(Number(steps[i + 1][1]) - Number(m[1]));
    });
  }
  const summary = {
    auto,
    spec: result.spec,
    design: result.design,
    commit: result.commit.slice(0, 7),
    ranAt: result.finishedAt,
    runs: result.runs.length,
    driveSeconds: Object.fromEntries(Object.entries(drives).map(([name, values]) => [name, { median: round(median(values)), runs: values.length }])),
    finishedAt: { median: round(median(finished)), runs: finished.length },
    tipAt: tips.map((values) => ({ median: round(median(values)), runs: values.length })),
  };
  writeFileSync(join(out, "sim", `${auto}.json`), JSON.stringify(summary, null, 2) + "\n");
}
// The robot's first match logs (25 Oct 2026) ran these drawings, and the team's measured timing
// facts are on the simulator branch.
const RAN_25_OCT = "d11eb1af";
mkdirSync(join(out, "real"), { recursive: true });
for (const auto of ["r-quals", "r-simple"]) {
  writeFileSync(join(out, "real", `${auto}.pp`), git("show", `${RAN_25_OCT}:TeamCode/autos/${auto}.pp`));
}
const simulator = git("rev-parse", "--short", "origin/claude/simulator").trim();
writeFileSync(join(out, "real", "timing.json"), git("show", "origin/claude/simulator:TeamCode/autos/timing.json"));

writeFileSync(
  join(out, "SOURCE.md"),
  `# Real data from biobuzz\n\nCopied by \`scripts/refresh-biobuzz-fixtures.mjs\`; do not edit by hand.\n\n` +
    `- \`autos/\`: \`TeamCode/autos/*.pp\` on biobuzz \`master\` at ${master}.\n` +
    `- \`sim/<auto>.pp\`: the exact file the simulator ran; \`sim/<auto>.json\`: a summary of its runs on the ` +
    `\`sim-results\` branch (median drive time per path, median time of each TIP).\n` +
    `- \`real/<auto>.pp\`: the drawings robot 20245 ran on 25 Oct 2026 (biobuzz ${RAN_25_OCT}); ` +
    `\`real/timing.json\`: the team's timing facts (\`claude/simulator\` at ${simulator}); ` +
    `\`real/2026-10-25.json\`: what the robot did, by hand from \`doc/real-vs-sim-25-oct.md\` there.\n`,
);
console.log(`wrote ${autos.length} Autos and 2 simulator summaries (biobuzz master ${master})`);
