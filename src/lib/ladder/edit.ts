/**
 * Edits to a ladder, as the plan view makes them. Each changes only `FirstOfCard.ladder` and
 * `AutoSection.plays`; the cards and paths follow when the editor builds the ladder
 * (`compileLadders`, after every edit).
 */
import { allCards } from "../auto/tree";
import type {
  AutoSection,
  FirstOfCard,
  Ladder,
  LadderTry,
  Play,
} from "../auto/types";

function waitOf(auto: AutoSection, waitId: string): FirstOfCard | null {
  const card = allCards(auto.cards).find((c) => c.id === waitId);
  return card?.kind === "firstOf" ? card : null;
}

/**
 * Starts a ladder on a wait: from then on its time-limit row is built from tries. A route drawn
 * there by hand is replaced, so the editor asks first.
 */
export function startLadder(auto: AutoSection, waitId: string): Ladder | null {
  const wait = waitOf(auto, waitId);
  if (!wait) return null;
  wait.ladder ??= { tries: [] };
  return wait.ladder;
}

/** Adds `play` as the last try, copying it into the file if this Auto has not used it yet. */
export function addTry(auto: AutoSection, waitId: string, play: Play): void {
  const ladder = startLadder(auto, waitId);
  if (!ladder || ladder.tries.some((t) => t.play === play.id)) return;
  auto.plays = { ...(auto.plays ?? {}) };
  auto.plays[play.id] ??= JSON.parse(JSON.stringify(play)) as Play;
  ladder.tries.push({ play: play.id });
}

export function removeTry(
  auto: AutoSection,
  waitId: string,
  index: number,
): void {
  const ladder = waitOf(auto, waitId)?.ladder;
  if (!ladder) return;
  ladder.tries.splice(index, 1);
  dropUnusedPlays(auto);
}

export function moveTry(
  auto: AutoSection,
  waitId: string,
  index: number,
  delta: -1 | 1,
): void {
  const tries = waitOf(auto, waitId)?.ladder?.tries;
  const to = index + delta;
  if (!tries || to < 0 || to >= tries.length) return;
  [tries[index], tries[to]] = [tries[to], tries[index]];
}

/** Sets one of a try's time limits, in seconds. */
export function setTryTime(
  auto: AutoSection,
  waitId: string,
  index: number,
  field: keyof Pick<LadderTry, "shootS" | "collectS">,
  seconds: number,
): void {
  const entry = waitOf(auto, waitId)?.ladder?.tries[index];
  if (entry) entry[field] = Math.round(seconds * 10) / 10;
}

/** A play's own time limit for a step kind, for a try that sets none. */
export function playSeconds(
  play: Play,
  kind: "shoot" | "collect",
): number | null {
  const steps = play.steps.filter((step) => step.kind === kind);
  const step = steps[steps.length - 1];
  return step && step.kind !== "drive" ? step.upToS : null;
}

/** Plays no ladder uses any more leave the file. */
function dropUnusedPlays(auto: AutoSection): void {
  if (!auto.plays) return;
  const used = new Set(
    allCards(auto.cards)
      .flatMap((card) =>
        card.kind === "firstOf" ? (card.ladder?.tries ?? []) : [],
      )
      .map((t) => t.play),
  );
  const kept = Object.fromEntries(
    Object.entries(auto.plays).filter(([id]) => used.has(id)),
  );
  if (Object.keys(kept).length) auto.plays = kept;
  else delete auto.plays;
}
