import { INDICATOR_DEFAULTS, type IndicatorNumbers } from "./indicator";
/**
 * The robot's controls, read from biobuzz: `TeamCode/cheat-sheets/controls.json`, which
 * biobuzz's `CheatSheetTest` writes from `controls/ControlScheme` (`ControlsExport`). Nothing
 * here names a button for an action: the file does. Gamepad 1 is the driver, gamepad 2 the
 * operator, as on the Driver Station.
 */

import type { LaunchSpotFile } from "./launchSpot";

export type Pad = "DRIVER" | "OPERATOR";

export interface Binding {
  pad: Pad;
  action: string;
  input: string;
  description: string;
}

export interface ControlsFile {
  about: string;
  flowerPickDefault: string;
  triggerPressed: number;
  inputs: { input: string; label: string; stick: boolean }[];
  layouts: { turretAiming: Binding[]; turretLocked: Binding[] };
  teleOp: Record<string, number | boolean>;
  /** The driver's Square: the launch spots and the numbers its drive and volley use (biobuzz `LaunchSpotsExport`). Absent from a file older than it. */
  launchSpots?: LaunchSpotFile;
  /** The indicator light's numbers (biobuzz `IndicatorSubsystem`, `ArcLight`). Absent from a file older than them. */
  indicator?: Partial<IndicatorNumbers>;
  practiceReadout: {
    budgetS: number;
    budgetPieces: number;
    mergeS: number;
    split: string[];
  };
}

const PATH = "TeamCode/cheat-sheets/controls.json";
export const CONTROLS_URL = `https://raw.githubusercontent.com/Mona-Shores-FTC-Robotics/biobuzz/master/${PATH}`;

/**
 * The controls file: GitHub first, then this site's mirror of biobuzz (scripts/mirror-biobuzz.mjs),
 * for a laptop that reaches the site but not GitHub's file server.
 */
export async function loadControls(
  fetcher: typeof fetch = fetch,
): Promise<{ file: ControlsFile; from: string }> {
  const tries = [
    CONTROLS_URL,
    new URL(`../mirror/master/${PATH}`, document.baseURI).href,
  ];
  let last = "";
  for (const url of tries) {
    try {
      const r = await fetcher(url, { cache: "no-cache" });
      if (!r.ok) {
        last = `${url}: HTTP ${r.status}`;
        continue;
      }
      const file = (await r.json()) as ControlsFile;
      validate(file);
      return { file, from: url };
    } catch (e) {
      last = `${url}: ${(e as Error).message}`;
    }
  }
  throw new Error(`The robot's controls did not load (${last})`);
}

/** Throws unless every action the drill runs is bound in the file. */
export function validate(file: ControlsFile): void {
  if (!file?.layouts?.turretAiming?.length)
    throw new Error("controls.json has no turretAiming layout");
  const bound = new Set(file.layouts.turretAiming.map((b) => b.action));
  const missing = REQUIRED.filter((a) => !bound.has(a));
  if (missing.length)
    throw new Error(`controls.json does not bind ${missing.join(", ")}`);
}

/** The actions the drill's TeleOp reads; a file without them is not the layout the drill knows. */
export const REQUIRED = [
  "DRIVE",
  "TURN",
  "INTAKE",
  "DRIVER_UNJAM",
  "SLOW",
  "FLOWER_PICK",
  "GARDEN_GATHER",
  "CHASSIS_AIM",
  "TURRET_LOCK",
  "OPERATOR_INTAKE",
  "UNJAM",
  "LAUNCHER_TOGGLE",
];

/**
 * A PlayStation controller in the browser's standard mapping. The robot's `Input` names, with
 * their button index (`Input` in biobuzz: PS5 name first, the SDK's Xbox name after).
 */
const BUTTON: Record<string, number> = {
  CROSS: 0,
  CIRCLE: 1,
  SQUARE: 2,
  TRIANGLE: 3,
  L1: 4,
  R1: 5,
  L2: 6,
  R2: 7,
  DPAD_UP: 12,
  DPAD_DOWN: 13,
  DPAD_LEFT: 14,
  DPAD_RIGHT: 15,
};

/** One gamepad, read once per loop: sticks as the SDK gives them (y down is +), buttons by input name. */
export interface PadRead {
  lx: number;
  ly: number;
  rx: number;
  held: (input: string) => boolean;
}

export const NO_PAD: PadRead = { lx: 0, ly: 0, rx: 0, held: () => false };

export function readPad(g: Gamepad | null, triggerPressed: number): PadRead {
  if (!g) return NO_PAD;
  const axis = (i: number) => g.axes[i] ?? 0;
  return {
    lx: axis(0),
    ly: axis(1),
    rx: axis(2),
    held: (input) => {
      const i = BUTTON[input];
      if (i === undefined) return false;
      const b = g.buttons[i];
      if (!b) return false;
      return input === "L2" || input === "R2"
        ? b.value > triggerPressed
        : b.pressed || b.value > 0.5;
    },
  };
}

/** Asks "is this action held / pressed this loop?", the way the TeleOp's `Controls` does. */
export class Controls {
  private layout = new Map<string, Binding>();
  private was = new Map<string, boolean>();
  private now = new Map<string, boolean>();

  constructor(
    private file: ControlsFile,
    turretLocked = false,
  ) {
    this.setLayout(turretLocked);
  }

  setLayout(turretLocked: boolean): void {
    this.layout.clear();
    const list = turretLocked
      ? this.file.layouts.turretLocked
      : this.file.layouts.turretAiming;
    for (const b of list) this.layout.set(b.action, b);
  }

  /** Reads both pads for this loop. An action the layout leaves out is never held. */
  poll(driver: PadRead, operator: PadRead): void {
    this.was = this.now;
    this.now = new Map();
    for (const [action, b] of this.layout) {
      const pad = b.pad === "DRIVER" ? driver : operator;
      this.now.set(action, pad.held(b.input));
    }
  }

  held(action: string): boolean {
    return this.now.get(action) ?? false;
  }

  /** Went down this loop. */
  on(action: string): boolean {
    return this.held(action) && !(this.was.get(action) ?? false);
  }

  binding(action: string): Binding | undefined {
    return this.layout.get(action);
  }

  /** The label a driver reads for an action's input, from the file ("Circle (B)"). */
  label(action: string): string {
    const b = this.layout.get(action);
    if (!b) return "—";
    return this.file.inputs.find((i) => i.input === b.input)?.label ?? b.input;
  }

  bindings(pad: Pad): Binding[] {
    return [...this.layout.values()].filter((b) => b.pad === pad);
  }

  get teleOp(): Record<string, number | boolean> {
    return this.file.teleOp;
  }

  /** The indicator light's numbers: the export's, else master's (./indicator.ts). */
  get indicator(): IndicatorNumbers {
    return { ...INDICATOR_DEFAULTS, ...(this.file.indicator ?? {}) };
  }

  get launchSpots(): LaunchSpotFile | undefined {
    return this.file.launchSpots;
  }
}
