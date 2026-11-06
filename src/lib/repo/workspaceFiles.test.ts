import { describe, expect, it } from "vitest";
import sample from "../auto/fixtures/hive-rush.pp?raw";
import { MemoryFolder, repoSaveFiles } from "./repoFolder";
import {
  createCheckpoint,
  listCheckpoints,
  listPartners,
  readFiles,
  recoverWrite,
  restoreCheckpoint,
  workspaceSavePlan,
  writeTransaction,
} from "./workspaceFiles";
import { checkoutBranch } from "./repoStore";

const PP = "TeamCode/autos/hive-rush.pp";
const JAVA =
  "TeamCode/src/main/java/org/firstinspires/ftc/teamcode/opmodes/auto/generated/HiveRushAuto.java";
const SPOTS = "TeamCode/autos/spots.json";
function folder() {
  const plan = repoSaveFiles("hive-rush.pp", sample);
  if (!plan.ok) throw new Error(plan.errors.join("; "));
  return new MemoryFolder("biobuzz", {
    ...plan.files,
    [SPOTS]: '{"spots":{}}',
    ".git/HEAD": "ref: refs/heads/Belding\n",
    "TeamCode/unrelated.java": "leave me alone",
  });
}

describe("local event workspace", () => {
  it("reads Belding and local partners without GitHub", async () => {
    const checkout = folder();
    await checkout.writeText("TeamCode/autos/partners/still.pp", sample);
    expect(await checkoutBranch(checkout)).toBe("Belding");
    expect(await listPartners(checkout)).toEqual(["partners/still.pp"]);
  });

  it("refuses to replace files edited since opening", async () => {
    const checkout = folder();
    const baseline = await readFiles(checkout, [PP, JAVA]);
    await checkout.writeText(PP, "someone else's newer auto");
    const writes = checkout.writes.length;
    await expect(
      writeTransaction(checkout, { [PP]: "ours", [JAVA]: "new" }, baseline),
    ).rejects.toThrow("changed on disk");
    expect(checkout.writes.length).toBe(writes);
    expect(await checkout.readText(PP)).toBe("someone else's newer auto");
  });

  it("rolls back both source and Java after a failed write", async () => {
    const checkout = folder();
    const before = await readFiles(checkout, [PP, JAVA]);
    const write = checkout.writeText.bind(checkout);
    let fail = true;
    checkout.writeText = async (path, text) => {
      if (path === JAVA && fail) {
        fail = false;
        throw new Error("disk full");
      }
      await write(path, text);
    };
    await expect(
      writeTransaction(checkout, { [PP]: "new source", [JAVA]: "new java" }),
    ).rejects.toThrow("disk full");
    expect(await readFiles(checkout, [PP, JAVA])).toEqual(before);
    expect(
      await checkout.readText("TeamCode/.auto-workspace/pending.json"),
    ).toBeNull();
  });

  it("recovers a save interrupted between its source and Java writes", async () => {
    const checkout = folder();
    const before = await readFiles(checkout, [PP, JAVA]);
    await checkout.writeText(
      "TeamCode/.auto-workspace/pending.json",
      JSON.stringify({
        version: 1,
        head: await checkout.readText(".git/HEAD"),
        files: before,
      }),
    );
    await checkout.writeText(PP, "partial save");
    await recoverWrite(checkout);
    expect(await readFiles(checkout, [PP, JAVA])).toEqual(before);
  });

  it("restores linked auto assets and preserves the experiment without touching other code", async () => {
    const checkout = folder();
    const good = await createCheckpoint(
      checkout,
      "Belding tested",
      "Belding",
      true,
    );
    await writeTransaction(checkout, {
      [PP]: "experiment",
      [JAVA]: "experiment java",
      [SPOTS]: '{"spots":{"LAUNCH":[3,4,5]}}',
      "TeamCode/autos/new-draft.pp": "new experiment",
    });
    await restoreCheckpoint(checkout, good, "Belding");
    expect(await checkout.readText(PP)).toBe(sample);
    expect(await checkout.readText(SPOTS)).toBe('{"spots":{}}');
    expect(await checkout.readText("TeamCode/autos/new-draft.pp")).toBeNull();
    expect(await checkout.readText("TeamCode/unrelated.java")).toBe(
      "leave me alone",
    );
    const points = await listCheckpoints(checkout);
    expect(points).toHaveLength(2);
    expect(points.find((p) => !p.tested)?.files[PP]).toBe("experiment");
  });

  it("keeps an interrupted save journal on its original branch during recovery", async () => {
    const checkout = folder();
    const before = await readFiles(checkout, [PP, JAVA]);
    const write = checkout.writeText.bind(checkout);
    let switchBranch = true;
    checkout.writeText = async (path, text) => {
      await write(path, text);
      if (path === PP && switchBranch) {
        switchBranch = false;
        await write(".git/HEAD", "ref: refs/heads/master\n");
      }
    };
    await expect(
      writeTransaction(checkout, { [PP]: "experiment", [JAVA]: "new Java" }),
    ).rejects.toThrow("branch changed");
    await expect(recoverWrite(checkout)).rejects.toThrow("another branch");
    expect(await checkout.readText(JAVA)).toBe(before[JAVA]);
    await checkout.writeText(".git/HEAD", "ref: refs/heads/Belding\n");
    await recoverWrite(checkout);
    expect(await readFiles(checkout, [PP, JAVA])).toEqual(before);
  });

  it("does not restore another event's checkpoint", async () => {
    const checkout = folder();
    const point = await createCheckpoint(checkout, "tested", "Belding", true);
    await expect(restoreCheckpoint(checkout, point, "master")).rejects.toThrow(
      "another branch",
    );
  });

  it("saves an explicitly opened partner without changing another auto", async () => {
    const checkout = folder();
    const partner = JSON.parse(sample);
    partner.auto.exportName = "partner-shoot-stay";
    const plan = await workspaceSavePlan(
      checkout,
      "partners/partner-shoot-stay.pp",
      JSON.stringify(partner),
    );
    await writeTransaction(checkout, plan.files);
    expect(await checkout.readText(PP)).toBe(sample);
    expect(await listPartners(checkout)).toEqual([
      "partners/partner-shoot-stay.pp",
    ]);
    expect(await checkout.readText(plan.javaPath)).toContain(
      'SOURCE = "partner-shoot-stay.pp"',
    );
  });

  it("rejects checkpoint paths outside auto assets before writing anything", async () => {
    const checkout = folder();
    const point = await createCheckpoint(checkout, "tested", "Belding", true);
    point.files[".git/HEAD"] = "ref: refs/heads/master";
    const writes = checkout.writes.length;
    await expect(restoreCheckpoint(checkout, point, "Belding")).rejects.toThrow(
      "Invalid auto snapshot path",
    );
    expect(checkout.writes.length).toBe(writes);
  });

  it("cannot overwrite another auto's generated class", async () => {
    const checkout = folder();
    const copy = JSON.parse(sample);
    copy.auto.exportName = "hive-rush";
    await expect(
      workspaceSavePlan(checkout, "another.pp", JSON.stringify(copy)),
    ).rejects.toThrow("belongs to hive-rush.pp");
  });
});
