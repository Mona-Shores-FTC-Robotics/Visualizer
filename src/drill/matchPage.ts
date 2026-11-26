/**
 * The robot's Driver Station Match page, as the drill shows it in its corner: the lines, order,
 * wording and colours biobuzz's TeleOp writes (opmodes/BasicDriveTeleOp onLoop), from biobuzz's
 * export `TeamCode/cheat-sheets/match-page.json` (MatchPageExport, kept fresh by CheatSheetTest),
 * never typed in here. The export gives each row's HTML in each state; the drill picks the state from
 * what the simulated robot knows, and leaves out what it cannot know (the loop time reads "--", the
 * Pinpoint is fine, the beam and the turret never fault).
 */
import type { TeleOpStatus } from "./teleop";

export interface MatchPageRow {
  id: string;
  shownWhen: string;
  /** HTML per state; the practice readout's are lists of lines. */
  samples: Record<string, string | string[]>;
}

export interface MatchPageFile {
  about: string;
  screenLines: number;
  levels: Record<string, string>;
  header: string;
  rows: MatchPageRow[];
}

const PATH = "TeamCode/cheat-sheets/match-page.json";
export const MATCH_PAGE_URL = `https://raw.githubusercontent.com/Mona-Shores-FTC-Robotics/biobuzz/master/${PATH}`;

/**
 * The export: GitHub first, then this site's mirror of biobuzz (scripts/mirror-biobuzz.mjs copies
 * the whole cheat-sheets folder). Null when neither has it: a biobuzz older than the export.
 */
export async function loadMatchPage(
  fetcher: typeof fetch = fetch,
): Promise<MatchPageFile | null> {
  const tries = [
    MATCH_PAGE_URL,
    new URL(`../mirror/master/${PATH}`, document.baseURI).href,
  ];
  for (const url of tries) {
    try {
      const r = await fetcher(url, { cache: "no-cache" });
      if (!r.ok) continue;
      const file = (await r.json()) as MatchPageFile;
      if (Array.isArray(file?.rows) && typeof file.header === "string")
        return file;
    } catch {
      /* the next */
    }
  }
  return null;
}

/** What the simulated robot knows, for the page. */
export interface MatchPageState {
  status: TeleOpStatus;
  /** Pieces in the lane, and whether that is the lane's capacity (the sensor reads full). */
  lane: number;
  laneFull: boolean;
  /** The turret locked forward (TurretSubsystem.lockedForward): no turret mode or aim trim rows. */
  turretLockedForward?: boolean;
  /** The intake runs all the time (TeleOpConfig.intakeAlwaysOn) and is running. */
  intakeRunning: boolean;
}

/** The nearest key of `row` to `value`, keys read as numbers. */
function nearestKey(row: MatchPageRow, value: number): string | null {
  let best: string | null = null,
    d = Infinity;
  for (const k of Object.keys(row.samples)) {
    const n = Number(k);
    if (!Number.isFinite(n)) continue;
    const e = Math.abs(n - value);
    if (e < d - 1e-9) {
      d = e;
      best = k;
    }
  }
  return best;
}

/**
 * The page's lines now: the header, then each row whose state the drill knows, in the export's
 * order. A row the export lacks, or a state it has no sample for, is left out.
 */
export function matchPageLines(
  file: MatchPageFile,
  s: MatchPageState,
): string[] {
  const st = s.status;
  const out = [file.header];
  const pick = (row: MatchPageRow, key: string | null) => {
    if (key === null) return;
    const v = row.samples[key];
    if (typeof v === "string") out.push(v);
  };
  for (const row of file.rows) {
    switch (row.id) {
      case "arcBlocked":
        if (st.firingArc === "blocked")
          pick(row, st.turretMode === "AIM" ? "aim" : "locked");
        break;
      case "outsideArc":
        if (st.firingArc === "outside") pick(row, "outside");
        break;
      case "wrongNectar":
        if (st.wrongNectar) pick(row, "shut");
        break;
      case "turretMode":
        if (!s.turretLockedForward)
          pick(row, st.turretMode === "AIM" ? "aim" : "locked");
        break;
      case "launchTrim":
        pick(row, nearestKey(row, st.launcherTrimTps));
        break;
      case "launcher":
        pick(
          row,
          st.launcher === "AT SPEED"
            ? "READY"
            : st.launcher === "SPINNING UP"
              ? "SPIN"
              : "IDLE",
        );
        break;
      case "pieces":
        pick(row, `${Math.min(4, s.lane)}${s.laneFull ? "_full" : ""}`);
        break;
      case "ourCell":
        // The CELL at the robot's end, as the simulator knows it: always a fresh reading.
        pick(row, st.nearCellUp ? "UP" : "DOWN");
        break;
      case "loop":
        pick(row, "--");
        break;
      case "pinpoint":
        pick(row, "OK");
        break;
      case "aimTrim":
        if (!s.turretLockedForward) pick(row, nearestKey(row, st.aimTrimDeg));
        break;
      case "aimTrimHint":
        if (!s.turretLockedForward) {
          const k = nearestKey(row, st.aimTrimDeg);
          if (k !== null && Math.abs(Number(k) - st.aimTrimDeg) <= 2.5)
            pick(row, k);
        }
        break;
      case "alert": {
        // The first that holds, in the export's order; the drill knows two of them.
        const holds: Record<string, boolean> = {
          "INTAKE OFF": !s.intakeRunning,
          "FLOWER STICK OUT": st.stickOut,
        };
        const key = Object.keys(row.samples).find((k) => holds[k]);
        if (key) pick(row, key);
        break;
      }
      case "keepHolding":
        if (st.resetHeld) pick(row, "holding");
        break;
      // fullHold and cellHold: TeleOpConfig gates the drill does not run. practiceReadout: the
      // drill's own readout times the cycle on the field, live; the export's are fixed samples.
    }
  }
  return out;
}

const ALLOWED = new Set(["b", "big", "small", "tt", "i", "u", "br", "font"]);

/**
 * A Driver Station line as safe HTML: its text escaped, and only the tags the Driver Station renders
 * (b, big, small, tt, i, u, br, and font with a colour) let through.
 */
export function dsHtml(line: string): string {
  return line.replace(/<[^>]*>|[^<]+|</g, (part) => {
    if (part === "<") return "&lt;";
    if (part.startsWith("<")) {
      const m = /^<(\/?)([a-z]+)([^>]*)>$/i.exec(part);
      if (!m || !ALLOWED.has(m[2].toLowerCase())) return "";
      const tag = m[2].toLowerCase();
      if (m[1]) return tag === "br" ? "" : `</${tag}>`;
      if (tag === "font") {
        const c = /color\s*=\s*"(#[0-9a-f]{3,8})"/i.exec(m[3]);
        return c ? `<font color="${c[1]}">` : "<font>";
      }
      return `<${tag}>`;
    }
    return part
      .replace(/&(?!(#\d+|#x[0-9a-f]+|[a-z]+);)/gi, "&amp;")
      .replace(/"/g, "&quot;");
  });
}
