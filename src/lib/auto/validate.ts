import type { BasePoint, StartPose } from "../../types";
import type { PathCatalog } from "./geometry";
import { isTimeRow, rowKind, type AutoCard, type AutoSection } from "./types";
import { describeRow } from "./tree";

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
    if (!name) error(cardId, `${what} has no action chosen.`);
    else if (!actions.has(name))
      error(cardId, `${what} uses "${name}", which is not a registered action.`);
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

    for (const card of list) {
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
          card.while.forEach((name) => checkAction(card.id, "While driving", name));
          card.events.forEach((event) => {
            checkAction(card.id, `The event at ${Math.round(event.at * 100)}%`, event.action);
            if (!(event.at >= 0 && event.at <= 1))
              error(card.id, "An event must sit between 0% and 100% of the path.");
          });
          at = [path.end];
          break;
        }
        case "firstOf": {
          const name = card.label || "This card";
          if (card.rows.length === 0) {
            error(card.id, `${name} has no rows, so it would wait forever.`);
            break;
          }
          if (!card.rows.some(isTimeRow)) {
            error(
              card.id,
              `${name} needs a time row (ms passed, time left, or otherwise) so it cannot wait forever.`,
            );
          }
          const ends: BasePoint[] = [];
          let earlierOtherwise = false;
          card.rows.forEach((row, rowIndex) => {
            const kind = rowKind(row);
            if (earlierOtherwise) {
              warn(card.id, `Row ${rowIndex + 1} (${describeRow(row)}) can never fire: an earlier "otherwise" row always wins.`, rowIndex);
            }
            if (kind === "otherwise") earlierOtherwise = true;
            if (kind === "when") {
              const names = (row as { when: string[] }).when;
              if (names.length === 0)
                error(card.id, `Row ${rowIndex + 1} has no condition chosen.`, rowIndex);
              names.forEach((condition) => {
                if (!conditions.has(condition))
                  error(card.id, `Row ${rowIndex + 1} uses "${condition}", which is not a registered condition.`, rowIndex);
              });
            }
            if (kind === "nearPoint") {
              const point = (row as { nearPoint: string }).nearPoint;
              if (!auto.points[point])
                error(card.id, `Row ${rowIndex + 1} names point "${point}", which is not defined.`, rowIndex);
            }
            if (kind === "inArea") {
              for (const point of (row as { inArea: [string, string] }).inArea) {
                if (!auto.points[point])
                  error(card.id, `Row ${rowIndex + 1} names point "${point}", which is not defined.`, rowIndex);
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
