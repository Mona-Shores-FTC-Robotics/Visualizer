/**
 * Fork: unlocking a team spot to move it asks first whether the move is for every Auto that uses
 * the spot or for this Auto alone. A team spot is shared by name, so moving it moves it in every
 * Auto that links it once saved; "this Auto alone" gives the open Auto its own new team spot,
 * where the old one is, and unlocks that instead (teamSpots.ts forkSpot). With no other Auto using
 * the spot there is nothing to ask.
 */
import { get } from "svelte/store";
import type { ProjectDoc } from "../../io";
import { choiceDialog, promptDialog } from "../dialog";
import { listPartners } from "../repo/workspaceFiles";
import { listRepoAutos, listRepoDrafts } from "../repo/repoFolder";
import { repoFolder } from "../repo/repoStore";
import {
  DEFAULT_REF,
  fetchText,
  listDraftFiles,
  listPartnerFiles,
  listTeamFiles,
  teamRawUrl,
  TEAM_DIR,
} from "./teamAutos";
import { forkName, forkSpot } from "./teamSpots";
import { editSpot, setSpotUnlocked, spotEdits, teamSpots } from "./spotsStore";

/** The Autos (file names under TeamCode/autos) whose `.pp` links each team spot, by spot. */
export function spotsUsedBy(
  files: { file: string; text: string }[],
): { file: string; exportName: string | null; spots: string[] }[] {
  return files.flatMap(({ file, text }) => {
    try {
      const auto = JSON.parse(text)?.auto;
      const spots = auto?.teamSpots;
      return Array.isArray(spots)
        ? [
            {
              file,
              exportName:
                typeof auto.exportName === "string" ? auto.exportName : null,
              spots: spots.filter((s: unknown) => typeof s === "string"),
            },
          ]
        : [];
    } catch {
      return [];
    }
  });
}

/** Every Auto, draft and stand-in's text: from the checkout when one is connected, else master. */
async function teamTexts(): Promise<{ file: string; text: string }[]> {
  const checkout = get(repoFolder);
  if (checkout) {
    const folder = checkout.folder;
    const names = [
      ...(await listRepoAutos(folder)),
      ...(await listRepoDrafts(folder)),
      ...(await listPartners(folder)),
    ];
    const texts = await Promise.all(
      names.map((n) => folder.readText(`${TEAM_DIR}/${n}`)),
    );
    return names.flatMap((file, i) =>
      texts[i] === null ? [] : [{ file, text: texts[i]! }],
    );
  }
  const names = [
    ...(await listTeamFiles(DEFAULT_REF)),
    ...(await listDraftFiles(DEFAULT_REF)),
    ...(await listPartnerFiles(DEFAULT_REF)),
  ];
  const texts = await Promise.all(
    names.map((n) => fetchText(teamRawUrl(DEFAULT_REF, n))),
  );
  return names.flatMap((file, i) =>
    texts[i] === null ? [] : [{ file, text: texts[i]! }],
  );
}

/**
 * The other Autos that link `name`, by file, leaving out the one open (the same export name); null
 * when the team's Autos could not be read.
 */
async function otherUsers(
  name: string,
  doc: ProjectDoc,
): Promise<string[] | null> {
  try {
    const own = doc.auto?.exportName ?? null;
    return spotsUsedBy(await teamTexts())
      .filter((a) => a.spots.includes(name))
      .filter((a) => own === null || a.exportName !== own)
      .map((a) => a.file.replace(/\.pp$/, ""));
  } catch {
    return null;
  }
}

/**
 * The lock button: locks an unlocked spot; unlocking one that other Autos use first asks whether
 * the move is for all of them or for this Auto alone. `current` is the open project and `apply`
 * replaces it.
 */
export async function toggleSpotLock(
  name: string,
  unlocked: boolean,
  current: () => ProjectDoc,
  apply: (doc: ProjectDoc) => void,
): Promise<void> {
  if (unlocked) return setSpotUnlocked(name, false);
  // Already moved here: that choice was made.
  if (get(spotEdits)[name]) return setSpotUnlocked(name, true);
  const doc = current();
  const others = await otherUsers(name, doc);
  if (others !== null && others.length === 0)
    return setSpotUnlocked(name, true);

  const taken = new Set([
    ...Object.keys(get(teamSpots)),
    ...Object.keys(doc.auto?.points ?? {}),
  ]);
  const suggested = forkName(name, taken);
  /** "r-clockwise, r-no-cross and 9 drafts or stand-ins": the Autos by name, the rest counted. */
  const usedBy = (files: string[]): string => {
    const autos = files.filter((f) => !f.includes("/"));
    const rest = files.length - autos.length;
    const parts = [
      ...autos,
      ...(rest
        ? [
            `${rest} draft${rest === 1 ? "" : "s"} or stand-in${rest === 1 ? "" : "s"}`,
          ]
        : []),
    ];
    return parts.length > 1
      ? `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`
      : parts[0];
  };
  const choice = await choiceDialog({
    title: `Move ${name}`,
    message:
      others === null
        ? "Other Autos may use it too (biobuzz could not be read)."
        : `Also used by ${usedBy(others)}.`,
    choices: [
      {
        id: "all",
        label: "Move it for every Auto",
        hint: "Every Auto that uses it moves with it, re-exported in the same save.",
      },
      {
        id: "own",
        label: "A new spot for this Auto only",
        hint: `This Auto gets its own spot, ${suggested}, where ${name} is now, and moves that. The others keep ${name}.`,
      },
    ],
  });
  if (choice === "all") return setSpotUnlocked(name, true);
  if (choice !== "own") return;

  const newName = await promptDialog({
    title: "Name the new spot",
    value: suggested,
    hint: `Side first, like ${suggested}: a team spot every Auto could use later.`,
    validate: (value) => {
      if (taken.has(value)) return `${value} is already a spot.`;
      const result = forkSpot(current(), name, value);
      return "problem" in result ? result.problem : null;
    },
  });
  if (!newName) return;
  const result = forkSpot(current(), name, newName);
  if ("problem" in result) return;
  apply(result.doc);
  editSpot(newName, result.doc.auto!.points[newName]);
  setSpotUnlocked(newName, true);
}
