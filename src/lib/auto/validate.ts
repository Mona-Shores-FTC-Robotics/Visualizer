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
        case "routine": {
          const routine = auto.routines[card.routine];
          const start = auto.points[card.at];
          if (!routine) {
            error(card.id, card.routine ? `Routine "${card.routine}" is not defined.` : "No routine chosen.");
          } else {
            if (routine.steps.length === 0) error(card.id, `Routine "${card.routine}" has no steps.`);
            if (!routine.endsWhen) error(card.id, `Routine "${card.routine}" needs a condition that ends it.`);
            else if (!conditions.has(routine.endsWhen))
              error(card.id, `Routine "${card.routine}" ends on "${routine.endsWhen}", which is not a registered condition.`);
            routine.while.forEach((name) => checkAction(card.id, `Routine "${card.routine}" (while)`, name));
            routine.exit.forEach((name) => checkAction(card.id, `Routine "${card.routine}" (on exit)`, name));
          }
          if (!start) error(card.id, card.at ? `Start point "${card.at}" is not defined.` : "No start point chosen.");
          if (!auto.points[card.exit])
            error(card.id, card.exit ? `Exit point "${card.exit}" is not defined.` : "No exit point chosen.");
          if (start) {
            const from = farthest(at, { x: start[0], y: start[1] });
            const gap = Math.hypot(start[0] - from.x, start[1] - from.y);
            if (gap > DISCONTINUITY_LIMIT_IN)
              warn(card.id, `The routine starts at ${card.at}, ${gap.toFixed(1)} in from where the robot can be.`);
          }
          const exit = auto.points[card.exit];
          if (exit) at = [{ x: exit[0], y: exit[1] }];
          break;
        }
        case "goTo": {
          const target = auto.points[card.point];
          if (!target) error(card.id, card.point ? `Point "${card.point}" is not defined.` : "No point chosen.");
          if (!(card.maxDistanceIn > 0)) error(card.id, "The farthest distance must be more than 0 in.");
          const refused = walk(card.ifRefused, at, `"If refused" of ${card.label || "Go to"}`);
          at = distinct([...(target ? [{ x: target[0], y: target[1] }] : []), ...refused]);
          break;
        }
        case "together": {
          const drivers = card.cards.filter(
            (child) => child.kind === "path" || child.kind === "routine" || child.kind === "goTo",
          );
          if (drivers.length > 1)
            warn(card.id, "More than one card here drives the robot; it can follow only one at a time.");
          if (card.cards.some((child) => child.kind === "path" && child.park))
            error(card.id, "A park path cannot run alongside other cards; put it in a branch or the main sequence.");
          const ends: BasePoint[] = [];
          card.cards.forEach((child) => ends.push(...walk([child], at, card.label || "Together")));
          const moved = ends.filter((end) => !at.includes(end));
          at = distinct(moved.length ? moved : at);
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
