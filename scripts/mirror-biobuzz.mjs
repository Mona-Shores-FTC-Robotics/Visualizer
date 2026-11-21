// Copies biobuzz's Autos (master: TeamCode/autos/) and scouting plans (scouting: scouting/) into the
// built site, for devices that reach this site but not GitHub's file server (src/lib/team/mirror.ts).
//   node scripts/mirror-biobuzz.mjs dist/mirror
// Each file lands at <out>/<branch>/<path>; each folder also gets contents.json, a listing shaped
// like GitHub's contents API ([{ name, type }]). A branch that cannot be fetched is skipped.
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const out = process.argv[2];
if (!out) {
  console.error("usage: node scripts/mirror-biobuzz.mjs <out dir>");
  process.exit(2);
}
const URL = "https://github.com/Mona-Shores-FTC-Robotics/biobuzz.git";
const COPIES = [
  { branch: "master", dir: "TeamCode/autos" },
  { branch: "scouting", dir: "scouting" },
];

const repo = mkdtempSync(join(tmpdir(), "biobuzz-"));
const git = (...args) =>
  execFileSync("git", ["-C", repo, ...args], {
    encoding: "utf8",
    maxBuffer: 1 << 28,
  });
git("init", "-q", "--bare");

for (const { branch, dir } of COPIES) {
  try {
    git(
      "fetch",
      "-q",
      "--depth",
      "1",
      URL,
      `+refs/heads/${branch}:refs/heads/${branch}`,
    );
  } catch {
    console.warn(`biobuzz has no ${branch} branch to mirror; skipped.`);
    continue;
  }
  const paths = git("ls-tree", "-r", "--name-only", branch, `${dir}/`)
    .split("\n")
    .filter(Boolean);
  /** folder → its entries, for the listings. */
  const folders = new Map();
  const enter = (folder, name, type) => {
    if (!folders.has(folder)) folders.set(folder, new Map());
    folders.get(folder).set(name, type);
  };
  for (const path of paths) {
    const target = join(out, branch, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(
      target,
      execFileSync("git", ["-C", repo, "show", `${branch}:${path}`], {
        maxBuffer: 1 << 28,
      }),
    );
    // Every folder from `dir` down lists what is in it.
    const parts = path.split("/");
    for (let i = dir.split("/").length; i < parts.length; i++) {
      enter(
        parts.slice(0, i).join("/"),
        parts[i],
        i === parts.length - 1 ? "file" : "dir",
      );
    }
  }
  for (const [folder, entries] of folders) {
    const listing = [...entries].map(([name, type]) => ({
      name,
      path: `${folder}/${name}`,
      type,
    }));
    writeFileSync(
      join(out, branch, folder, "contents.json"),
      JSON.stringify(listing),
    );
  }
  console.log(`Mirrored ${paths.length} files from biobuzz ${branch}:${dir}.`);
}
rmSync(repo, { recursive: true, force: true });
