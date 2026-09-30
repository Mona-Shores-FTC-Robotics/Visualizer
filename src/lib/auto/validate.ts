import type { BasePoint, StartPose } from "../../types";
import type { PathCatalog } from "./geometry";
import { rowKind, type AutoCard, type AutoSection } from "./types";
import { allCards, rejoinTail } from "./tree";
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
            if (tail.target.through) {
              error(card.id, "This rejoin joins a drive-through; join at a stop, where the robot stops.");
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
            at = [path.end];
          }
          break;
        }
        case "firstOf": {
          const name = card.label || "This wait";
          if (card.alongside) checkAction(card.id, "The command run while waiting", card.alongside);
          const whens = card.rows.filter((row) => rowKind(row) === "when");
          const limits = card.rows.filter((row) => rowKind(row) === "afterMs");
          if (whens.length !== 1 || limits.length !== 1 || card.rows.length !== 2) {
            error(card.id, `${name} needs exactly one trigger and one time limit.`);
          }
          const ends: BasePoint[] = [];
          card.rows.forEach((row, rowIndex) => {
            if ("when" in row) {
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

  for (const [name, point] of Object.entries(auto.points)) {
    if (!/^[A-Za-z][A-Za-z0-9 _-]*$/.test(name)) {
      error(null, `Point name "${name}" must start with a letter and use letters, digits, spaces, _ or -.`);
    }
    if (!point.every(Number.isFinite)) error(null, `Point "${name}" has a coordinate that is not a number.`);
  }
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
