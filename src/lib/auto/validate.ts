import type { BasePoint, StartPose } from "../../types";
import type { PathCatalog } from "./geometry";
import { rowKind, type AutoCard, type AutoSection, type PathCard } from "./types";
import { allCards, childLists, parkSpots, rejoinTail } from "./tree";
import { isUsed, pointUses } from "./pins";

export type IssueLevel = "error" | "warning";

export interface AutoIssue {
  level: IssueLevel;
  /** The card the issue is about; null for the Auto as a whole. */
  cardId: string | null;
  /** Row index within a decision, when the issue is about one row. */
  rowIndex?: number;
  message: string;
}

/** How far apart two consecutive paths may end and start, in inches. */
export const DISCONTINUITY_LIMIT_IN = 2;

/**
 * Everything wrong with the Auto. Errors block the Java export; warnings are
 * shown next to the card but do not.
 */
export function validateAuto(
  auto: AutoSection,
  catalog: PathCatalog,
  startPoint: StartPose,
): AutoIssue[] {
  const issues: AutoIssue[] = [];
  const actions = new Set(auto.registry.actions);
  const conditions = new Set(auto.registry.conditions);
  const error = (cardId: string | null, message: string, rowIndex?: number) =>
    issues.push({ level: "error", cardId, message, rowIndex });
  const warn = (cardId: string | null, message: string, rowIndex?: number) =>
    issues.push({ level: "warning", cardId, message, rowIndex });

  const checkAction = (cardId: string, what: string, name: string) => {
    if (!name) error(cardId, `${what} has no command chosen.`);
    else if (!actions.has(name))
      error(cardId, `${what} uses "${name}", which is not in the robot's list of commands.`);
  };

  // The robot may reach a card from several places (one per branch of an
  // earlier decision), so track every place it could be.
  const walk = (
    list: AutoCard[],
    entry: BasePoint[],
    branch: string,
  ): BasePoint[] => {
    let at = entry;
    const parks = list.filter((card) => card.kind === "path" && card.park);
    if (parks.length > 1) {
      parks
        .slice(1)
        .forEach((card) =>
          error(card.id, `${branch} has more than one park path; mark only one.`),
        );
    }
    const park = parks[0];
    if (park && list[list.length - 1] !== park) {
      warn(park.id, `The park path is not the last card of ${branch.toLowerCase()}; cards after it still run.`);
    }

    for (const [index, card] of list.entries()) {
      switch (card.kind) {
        case "action":
          checkAction(card.id, "This action card", card.name);
          break;
        case "path": {
          const path = catalog.byId.get(card.lineId);
          if (!path) {
            error(
              card.id,
              catalog.nestedIds.has(card.lineId)
                ? "This path is inside a group; pick the group instead (Pedro follows a group as one path)."
                : "The path this card drives no longer exists.",
            );
            break;
          }
          const from = farthest(at, path.start);
          const gap = Math.hypot(path.start.x - from.x, path.start.y - from.y);
          if (gap > DISCONTINUITY_LIMIT_IN) {
            warn(
              card.id,
              `${path.name} starts ${gap.toFixed(1)} in from where the robot can be (${from.x.toFixed(1)}, ${from.y.toFixed(1)}). Add a path that joins them.`,
            );
          }
          if (card.through) {
            const next = list[index + 1];
            if (next?.kind !== "path") {
              error(card.id, `${path.name} is a drive-through, so a path must come straight after it in the same route.`);
            }
            if (card.park) error(card.id, "The park path cannot be a drive-through: the Auto ends there.");
          }
          at = [path.end];
          break;
        }
        case "rejoin": {
          const path = catalog.byId.get(card.lineId);
          const tail = rejoinTail(auto.cards, card.target);
          if (!path) error(card.id, "The path this rejoin drives no longer exists.");
          if (!tail) {
            error(card.id, "This rejoin's target stop no longer exists; pick the stop to join at.");
          } else {
            if (allCards(tail.list.slice(tail.index)).includes(card) || allCards([tail.target]).includes(card)) {
              error(card.id, "This rejoin joins a stop before itself, so the Auto would loop.");
            }
            const targetPath = catalog.byId.get(tail.target.lineId);
            if (path && targetPath) {
              const gap = Math.hypot(path.end.x - targetPath.end.x, path.end.y - targetPath.end.y);
              if (gap > DISCONTINUITY_LIMIT_IN) {
                warn(card.id, `${path.name} ends ${gap.toFixed(1)} in from the stop it rejoins; end it on the same spot.`);
              }
            }
          }
          if (index !== list.length - 1) {
            error(card.id, "A rejoin must be the last step of its route: after it the other route's steps run.");
          }
          if (path) {
            const from = farthest(at, path.start);
            const gap = Math.hypot(path.start.x - from.x, path.start.y - from.y);
            if (gap > DISCONTINUITY_LIMIT_IN) {
              warn(card.id, `${path.name} starts ${gap.toFixed(1)} in from where the robot can be (${from.x.toFixed(1)}, ${from.y.toFixed(1)}).`);
            }
            // After a rejoin the robot runs the rest of the route it joined, so it ends where
            // that route's last drive ends.
            const joined = tail ? tail.list.slice(tail.index) : [];
            const last = joined.filter((c): c is PathCard => c.kind === "path").pop();
            const lastPath = last ? catalog.byId.get(last.lineId) : undefined;
            at = [lastPath?.end ?? path.end];
          }
          break;
        }
        case "firstOf": {
          const name = card.label || "This wait";
          if (card.alongside) checkAction(card.id, "The command run while waiting", card.alongside);
          const whens = card.rows.filter((row) => rowKind(row) === "when");
          const limits = card.rows.filter((row) => rowKind(row) === "afterMs");
          // Fork: a wait for nothing but its time (one time row, no steps of its own) is a plain wait.
          const timeOnly = card.rows.length === 1 && limits.length === 1 && limits[0].cards.length === 0;
          if (!timeOnly && (whens.length !== 1 || limits.length !== 1 || card.rows.length !== 2)) {
            error(card.id, `${name} needs exactly one trigger and one time limit.`);
          }
          const ends: BasePoint[] = [];
          card.rows.forEach((row, rowIndex) => {
            if ("when" in row && !card.choice) {
              if (row.when.length === 0) error(card.id, `${name} has no trigger chosen.`, rowIndex);
              for (const condition of row.when) {
                if (!conditions.has(condition))
                  error(card.id, `${name} waits for "${condition}", which is not in the robot's list of triggers.`, rowIndex);
              }
            }
            ends.push(...walk(row.cards, at, `Row ${rowIndex + 1} of ${name}`));
          });
          at = distinct(ends);
          break;
        }
      }
    }
    return at;
  };

  walk(auto.cards, [startPoint], "The main sequence");

  // The drive team moves one wait's limit on the D-pad; a second would have no keys.
  allCards(auto.cards)
    .filter((card) => card.kind === "firstOf" && card.partnerWait)
    .slice(1)
    .forEach((card) =>
      error(
        card.id,
        `${card.kind === "firstOf" && card.label ? card.label : "This wait"} is marked as the partner wait, but another wait already is: an Auto has one.`,
      ),
    );
  for (const card of allCards(auto.cards)) {
    if (
      card.kind === "firstOf" &&
      card.partnerWait &&
      card.rows.some((row) => "afterMs" in row && row.matchClock)
    )
      error(
        card.id,
        `${card.label || "This wait"} is the partner wait, so its time limit counts from when the wait starts, not the match clock.`,
      );
  }

  for (const [name, point] of Object.entries(auto.points)) {
    if (!/^[A-Za-z][A-Za-z0-9 _-]*$/.test(name)) {
      error(null, `Point name "${name}" must start with a letter and use letters, digits, spaces, _ or -.`);
    }
    if (!point.every(Number.isFinite)) error(null, `Point "${name}" has a coordinate that is not a number.`);
  }
  // Fork: a route choice, the stops that shoot by camera or timer, and the INIT menu's times
  // (types.ts FirstOfCard.choice and shot, AfterMsRow.option).
  const choiceNames = new Map<string, string>();
  const timeOf = new Map<string, number>();
  for (const card of allCards(auto.cards)) {
    if (card.kind !== "firstOf") continue;
    const name = card.label || "This wait";
    if (card.choice) {
      if (card.rows.some((row) => !row.label?.trim() || row.cards.length === 0))
        error(card.id, `${name}: each leg of the "${card.choice}" choice needs a name and at least one step.`);
      // A leg holds drives, commands and plain waits. It may end with the park, if the other leg
      // does too: then each way parks by its own road and nothing follows the choice.
      const isPark = (c: AutoCard) => c.kind === "path" && c.park;
      const parkLast = (row: (typeof card.rows)[number]) =>
        row.cards.length > 0 && isPark(row.cards[row.cards.length - 1]);
      if (card.rows.some((row) => row.cards.some((c, i) => childLists(c).some((list) => list.length > 0) || (isPark(c) && i !== row.cards.length - 1) || c.kind === "rejoin")))
        error(card.id, `${name}: a leg of the "${card.choice}" choice holds drives, commands and plain waits only, and may end with the park; a decision goes after it.`);
      if (card.rows.some(parkLast) && !card.rows.every(parkLast))
        error(card.id, `${name}: one leg of the "${card.choice}" choice ends with the park and the other does not; both park, or the park goes after the choice.`);
      if (card.shot || card.alongside || card.partnerWait)
        error(card.id, `${name} is the "${card.choice}" choice; it cannot also be a wait with a command, a partner wait or a camera-or-timer stop.`);
      const names = card.rows.map((row) => row.label?.trim() ?? "").join(", ");
      const seen = choiceNames.get(card.choice);
      if (seen !== undefined && seen !== names)
        error(card.id, `${name}: the "${card.choice}" choice has legs named ${names} here and ${seen} elsewhere; they must be the same, in the same order.`);
      choiceNames.set(card.choice, names);
    }
    const limit = card.rows.find((row) => "afterMs" in row);
    if (card.shot && !(limit && "afterMs" in limit && limit.matchClock && card.rows.length === 2))
      error(card.id, `${name} shoots by the camera or the timer, so it needs a trigger and a time on the match clock.`);
    for (const row of card.rows) {
      if (!("afterMs" in row) || !row.option) continue;
      if (row.adjustable)
        error(card.id, `${name}: its time is "${row.option}" on the INIT menu; it cannot also be the partner wait.`);
      const seen = timeOf.get(row.option);
      if (seen !== undefined && seen !== row.afterMs)
        error(card.id, `${name}: "${row.option}" is ${row.afterMs / 1000} s here and ${seen / 1000} s elsewhere; one name is one time.`);
      timeOf.set(row.option, row.afterMs);
    }
  }
  if (auto.partner?.follows && !choiceNames.has(auto.partner.follows))
    error(null, `The partner note follows "${auto.partner.follows}", which is not a route choice of this Auto.`);

  // Fork: what the drive team may change in INIT (types.ts parkChoices, AfterMsRow.adjustable).
  if (auto.parkChoices?.length) {
    const drawn = parkSpots(auto, catalog);
    if (drawn.size === 0)
      error(null, "The Auto offers other parks in INIT but has no park step.");
    else if (drawn.size > 1)
      error(null, `The Auto offers other parks in INIT, but its parks end on different spots (${[...drawn].join(", ")}).`);
    for (const name of auto.parkChoices) {
      if (!auto.points[name]) error(null, `The park offered in INIT, ${name}, is not one of this Auto's spots.`);
      else if (drawn.has(name)) error(null, `${name} is the park step's own spot; offer another one in INIT.`);
    }
  }
  const adjustable = allCards(auto.cards).filter(
    (card) =>
      card.kind === "firstOf" &&
      card.rows.some((row) => "afterMs" in row && row.adjustable),
  );
  if (adjustable.length > 1)
    for (const card of adjustable)
      error(card.id, "Only one wait per Auto can be changed in INIT.");

  const uses = pointUses(auto);
  for (const name of Object.keys(auto.points)) {
    if (!isUsed(uses.get(name))) {
      warn(null, `Point "${name}" is not used: no path ends on it and no card names it. Remove it, or pin a path's end to it.`);
    }
  }
  return issues;
}

function farthest(points: BasePoint[], target: BasePoint): BasePoint {
  return points.reduce((worst, point) =>
    Math.hypot(point.x - target.x, point.y - target.y) >
    Math.hypot(worst.x - target.x, worst.y - target.y)
      ? point
      : worst,
  );
}

function distinct(points: BasePoint[]): BasePoint[] {
  const out: BasePoint[] = [];
  for (const point of points) {
    if (!out.some((p) => Math.hypot(p.x - point.x, p.y - point.y) < 1e-6)) out.push(point);
  }
  return out;
}

export function hasErrors(issues: AutoIssue[]): boolean {
  return issues.some((issue) => issue.level === "error");
}

export function issuesFor(issues: AutoIssue[], cardId: string): AutoIssue[] {
  return issues.filter((issue) => issue.cardId === cardId);
}
