/**
 * The driver drill page (drill/index.html): a 2:00 TeleOp toward 7 TIPs, on our robot's controls
 * and numbers. Solo, gamepad 1 is the driver and gamepad 2 the operator. As an alliance, our two
 * robots share one field: gamepad 1 drives the robot picked under Robot, gamepad 2 its partner,
 * each a driver alone with the turret aiming (AIM).
 */
import RAPIER from "@dimforge/rapier3d-compat";
import {
  Controls,
  loadControls,
  readPad,
  type ControlsFile,
  type Pad,
} from "./controls";
import {
  bestRun,
  loadHistory,
  saveRun,
  summarize,
  type StoredRun,
} from "./history";
import { PRESETS, IN, type TeamNumber } from "./presets";
import { BUDGET_PIECES, BUDGET_S } from "./readout";
import {
  DrillSession,
  GOAL_TIPS,
  TEAM_NAMES,
  TIP_TIMINGS,
  type TipTiming,
  type DrillMode,
  type RobotRunResult,
  type RunResult,
} from "./session";
import { DrillView, CAMERAS, type CameraMode } from "./view";

const $ = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const f1 = (v: number) => (Number.isFinite(v) ? v.toFixed(1) : "–");
const clock = (s: number) =>
  `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const esc = (s: string) =>
  s.replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!,
  );

const prefs = (() => {
  try {
    return JSON.parse(localStorage.getItem("biobuzz-drill-prefs") ?? "{}") as {
      team?: string;
      mode?: string;
      camera?: string;
      tipTiming?: string;
      /** Per mode, per robot: the gamepad (0-3, -1 none) of its driver and of its operator. */
      assign?: Record<string, [number, number][]>;
    };
  } catch {
    return {};
  }
})();
function savePrefs() {
  try {
    localStorage.setItem(
      "biobuzz-drill-prefs",
      JSON.stringify({
        team: teamSel.value,
        mode: modeSel.value,
        camera: camSel.value,
        tipTiming: tipSel.value,
        assign: prefs.assign,
      }),
    );
  } catch {
    /* not kept */
  }
}

const teamSel = $<HTMLSelectElement>("team");
const modeSel = $<HTMLSelectElement>("mode");
const camSel = $<HTMLSelectElement>("camera");
const tipSel = $<HTMLSelectElement>("tip-timing");
tipSel.innerHTML = TIP_TIMINGS.map(
  (t) => `<option value="${t.value}">${t.label}</option>`,
).join("");
if (prefs.tipTiming) tipSel.value = prefs.tipTiming;
if (prefs.team) teamSel.value = prefs.team;
if (prefs.mode) modeSel.value = prefs.mode;
if (prefs.camera) camSel.value = prefs.camera;

let file: ControlsFile;
let session: DrillSession;
let view: DrillView;
let saved = false;
let startWas = false;
let viewWas = false;

function fatal(msg: string) {
  $("fatal").hidden = false;
  $("fatal-card").innerHTML =
    `<h2>The drill cannot start</h2><p>${esc(msg)}</p><p class="dim">The controls come from biobuzz (TeamCode/cheat-sheets/controls.json). Check the connection and reload.</p>`;
}

const alliance = () => modeSel.value.startsWith("alliance");

/** Who holds which gamepad, by default: solo as the Driver Station (1 driver, 2 operator). */
const DEFAULT_ASSIGN: Record<string, [number, number][]> = {
  two: [[0, 1]],
  driver: [[0, -1]],
  alliance: [
    [0, -1],
    [1, -1],
  ],
  "alliance-ops": [
    [0, 1],
    [2, 3],
  ],
};
/** Each robot's [driver, operator] gamepad (0-3, -1 none) in this mode. */
function assignment(): [number, number][] {
  const mode = modeSel.value;
  const a = prefs.assign?.[mode] ?? DEFAULT_ASSIGN[mode] ?? DEFAULT_ASSIGN.two;
  // A mode without operators never takes one, whatever was saved.
  return a.map(([d, o]) => [
    d,
    mode === "driver" || mode === "alliance" ? -1 : o,
  ]);
}
/** Robot 1 is the team picked under Robot; in an alliance its partner is the other. */
function teams(): TeamNumber[] {
  const first = Number(teamSel.value) as TeamNumber;
  return alliance() ? [first, first === 20245 ? 19429 : 20245] : [first];
}

function newSession() {
  const mode = modeSel.value as DrillMode;
  session = new DrillSession(
    RAPIER,
    file,
    teams().map((team, k) => ({
      team,
      driverOnly: (assignment()[k]?.[1] ?? -1) < 0,
    })),
    mode,
    undefined,
    tipSel.value as TipTiming,
  );
  saved = false;
  $("results").hidden = true;
  showNumbers();
  showHistory();
  Object.assign(window as unknown as Record<string, unknown>, {
    __drill: { session, file },
  });
}

function start() {
  if (!session || session.finished) newSession();
  session.start();
}

function showControls() {
  const c = new Controls(file);
  for (const pad of ["DRIVER", "OPERATOR"] as Pad[]) {
    const rows = c
      .bindings(pad)
      .map(
        (b) =>
          `<tr><td>${esc(c.label(b.action))}</td><td>${esc(b.description.replace(/^\*/, ""))}${b.description.startsWith("*") ? ' <span class="dim">(work in progress)</span>' : ""}</td></tr>`,
      )
      .join("");
    $(pad === "DRIVER" ? "driver-controls" : "operator-controls").innerHTML =
      rows;
  }
}

function showNumbers() {
  $("numbers").innerHTML = teams().map(numbersFor).join("");
}

function numbersFor(team: TeamNumber) {
  const p = PRESETS[team];
  return `<p><b>${TEAM_NAMES[team]}</b></p><table>
    <tr><td>Top speed</td><td>${p.topSpeedInPerS} in/s</td></tr>
    <tr><td>Acceleration</td><td>${p.accelInPerS2} in/s²</td></tr>
    <tr><td>Turn</td><td>${p.turnRateDegPerS}°/s</td></tr>
    <tr><td>FLOWER pick</td><td>${p.flowerPick.seconds} s</td></tr>
    <tr><td>GARDEN gather</td><td>${p.gardenGather.seconds} s</td></tr>
    <tr><td>Lane</td><td>${p.laneCapacity}</td></tr>
    <tr><td>Fire to gate</td><td>${p.spinUpFromIdleS} s idle, ${p.spinUpWhenSpunS} s spun up</td></tr>
    <tr><td>Gate to 4th ball</td><td>${p.gateToLastOfFourS} s</td></tr>
    <tr><td>Firing arc</td><td>${p.enforceFiringArc ? "enforced" : "not enforced (RobotDifferences)"}</td></tr>
  </table><p>${p.sources.map(esc).join("; ")}.</p>`;
}

const modeName = (m: string) =>
  m === "two"
    ? "two players"
    : m === "driver"
      ? "driver only"
      : m === "alliance"
        ? "alliance, drivers"
        : "alliance, drivers and operators";

function showHistory(list: StoredRun[] = loadHistory()) {
  const team = Number(teamSel.value);
  const ally = alliance();
  const mine = list
    .filter((r) => r.team === team && r.mode.startsWith("alliance") === ally)
    .slice(-8)
    .reverse();
  const timing = tipSel.value as TipTiming;
  const best = ally
    ? bestRun(list, team, modeSel.value, timing)
    : bestRun(mine, team, undefined, timing);
  if (!mine.length) {
    $("history").textContent = ally
      ? "No alliance runs on this laptop yet."
      : `No ${team} runs on this laptop yet.`;
    return;
  }
  $("history").innerHTML =
    (best
      ? `<p>Best: <b>${best.tips} TIPs</b>${best.goalAtS != null ? `, 7th at ${clock(best.goalAtS)}` : ""}, median cycle ${f1(best.medianCycleS ?? NaN)} s (${modeName(best.mode)}, ${TIP_TIMINGS.find((t) => t.value === timing)?.label}, ${best.date.slice(0, 10)})</p>`
      : "") +
    `<table>${mine.map((r) => `<tr><td>${r.date.slice(5, 16).replace("T", " ")}</td><td>${r.tips} TIPs · ${r.cycles} cycles · med ${f1(r.medianCycleS ?? NaN)} s</td></tr>`).join("")}</table>`;
}

function cycleTable(x: RobotRunResult) {
  const rows = x.cycles
    .map(
      (c) =>
        `<tr><td>${c.n}</td><td>${f1(c.atS)}</td><td class="${c.cycleS <= BUDGET_S && c.balls >= BUDGET_PIECES ? "goal" : ""}">${f1(c.cycleS)}</td><td>${f1(c.toPiecesS)}</td><td>${f1(c.pickUpS)}</td><td>${f1(c.driveLoadedS)}</td><td>${f1(c.spinUpAimS)}</td><td>${f1(c.feedS)}</td><td>${c.balls}${c.emptyFeeds ? ` (+${c.emptyFeeds} empty)` : ""}</td></tr>`,
    )
    .join("");
  const picks = x.pickUps
    .map((p) => `${f1(p.s)} s (${p.pieces} in${p.full ? "" : ", fired short"})`)
    .join(" · ");
  const c = x.cycles.map((q) => q.cycleS).sort((a, b) => a - b);
  const p = x.pickUps.map((q) => q.s).sort((a, b) => a - b);
  return `<p>Cycles: best ${f1(c[0] ?? NaN)} s, median ${f1(c[Math.floor(c.length / 2)] ?? NaN)} s against the ${BUDGET_S} s budget with ${BUDGET_PIECES} pieces. Pick-ups: best ${f1(p[0] ?? NaN)} s, median ${f1(p[Math.floor(p.length / 2)] ?? NaN)} s.</p>
    <table><tr><th>#</th><th>at</th><th>cycle</th><th>to pieces</th><th>pick up</th><th>drive loaded</th><th>spin-up and aim</th><th>feed</th><th>balls</th></tr>${rows || '<tr><td colspan="9">No volley this run.</td></tr>'}</table>
    <p class="dim">Pick-ups: ${picks || "–"}</p>`;
}

function showResults(r: RunResult) {
  const list = saveRun(summarize(r));
  showHistory(list);
  const best = bestRun(list, r.team, r.mode, r.tipTiming);
  const isBest = best && best.date === r.date;
  const who = r.mode.startsWith("alliance")
    ? `Alliance: ${r.robots.map((x) => TEAM_NAMES[x.team]).join(" and ")}, ${r.mode === "alliance" ? "a driver each" : "a driver and an operator each"}`
    : `${TEAM_NAMES[r.team]}, ${r.mode === "two" ? "driver + operator" : "driver only"}`;
  const timingLabel = TIP_TIMINGS.find((t) => t.value === r.tipTiming)?.label;
  const robots = r.mode.startsWith("alliance")
    ? r.robots
        .map(
          (x) =>
            `<h3>${TEAM_NAMES[x.team]} <span class="dim">· the ${x.end} end · ${x.balls} balls · ${x.volleys} volleys, ${x.volleysOffEnd} off its end, ${x.volleysAtDown} at a down CELL</span></h3>${cycleTable(x)}`,
        )
        .join("")
    : cycleTable(r.robots[0]);
  $("results-card").innerHTML = `
    <h2>${r.tips >= GOAL_TIPS ? `<span class="goal">${r.tips} TIPs: goal!</span>` : `<span class="miss">${r.tips} of ${GOAL_TIPS} TIPs</span>`}${isBest ? ' <span class="goal">· new best</span>' : ""}</h2>
    <p>${who}, ${timingLabel}. ${r.balls} balls launched${r.goalAtS != null ? `; the 7th TIP settled at ${clock(r.goalAtS)} of 2:00` : ""}.
    TIPs settled at ${r.tipTimes.map((t) => f1(t)).join(", ") || "–"} s.</p>
    ${robots}
    ${best && !isBest ? `<p class="dim">Best ${modeName(r.mode)} run on this laptop: ${best.tips} TIPs${best.goalAtS != null ? `, 7th at ${clock(best.goalAtS)}` : ""}, median cycle ${f1(best.medianCycleS ?? NaN)} s.</p>` : ""}
    <p><button class="primary" id="again">Run again (Options)</button></p>`;
  $("results").hidden = false;
  $("again").onclick = () => {
    newSession();
    start();
  };
}

function robotBox(k: number) {
  const st = session.teleops[k].status();
  const head =
    session.teleops.length > 1
      ? `<b>${TEAM_NAMES[session.slots[k].team]}</b> <span class="dim">gamepad ${k + 1} · the ${session.ends[k]} end</span><br>`
      : "";
  return `<div class="robot-box">${head}${st.nearCellUp ? '<b style="color:var(--ok)">OUR CELL UP</b>' : '<b style="color:var(--warn)">OUR CELL DOWN: LOAD 4</b>'} <span class="dim">(${st.nearCell} end)</span><br>
    Turret <span class="tag ${st.turretMode === "AIM" ? "aim" : "locked"}">${st.turretMode}</span> ${st.insideArc ? "" : '<span style="color:var(--warn)">aim behind the arc</span>'}<br>
    Lane ${"●".repeat(st.lane)}${"○".repeat(Math.max(0, session.presets[k].laneCapacity - st.lane))} · launcher ${st.launcher}${st.gateOpen ? " · <b>feeding</b>" : ""}<br>
    ${st.routine ?? (st.arcTurning ? "arc turn" : st.chassisAiming ? "turning onto the CELL" : st.slow ? "slow" : "&nbsp;")}${st.aimTrimDeg ? ` · aim trim ${st.aimTrimDeg.toFixed(1)}°` : ""}</div>`;
}

function readoutBox(k: number) {
  const r = session.readouts[k],
    p = r.pickUps.at(-1),
    c = r.cycles.at(-1),
    s = r.stats();
  const head =
    session.teleops.length > 1
      ? `<div><b>${TEAM_NAMES[session.slots[k].team]}</b></div>`
      : "";
  return `<div class="readout-box">${head}${[
    p
      ? `<div class="big ${p.full ? "ok" : "warn"}">PICK-UP ${f1(p.s)} s (${p.pieces} in)</div>`
      : "",
    c
      ? `<div class="big ${c.cycleS <= BUDGET_S && c.balls >= BUDGET_PIECES ? "ok" : ""}">CYCLE ${f1(c.cycleS)} s · ${c.balls} ball${c.balls === 1 ? "" : "s"}</div><div>to pieces ${f1(c.toPiecesS)} | pick ${f1(c.pickUpS)} | loaded ${f1(c.driveLoadedS)} | spin+aim ${f1(c.spinUpAimS)} | feed ${f1(c.feedS)}${c.emptyFeeds ? ` · +${c.emptyFeeds} empty feed${c.emptyFeeds === 1 ? "" : "s"}` : ""}${c.earlyPresses ? ` · ${c.earlyPresses} early press${c.earlyPresses === 1 ? "" : "es"}` : ""}</div>`
      : "",
    `<div class="dim">${r.cycles.length ? `cycle best ${f1(s.bestCycleS)} · median ${f1(s.medianCycleS)} s (${r.cycles.length})` : "PRACTICE: fire a volley to time a cycle"}${r.pickUps.length ? ` · pick-up best ${f1(s.bestPickUpS)} · median ${f1(s.medianPickUpS)}` : ""}</div>`,
  ].join("")}</div>`;
}

function hud() {
  $("clock").innerHTML =
    `${clock(Math.ceil(session.remainingS))}<small>${session.finished ? "ended" : session.t > 0 ? "TeleOp" : "press Options to start"}</small>`;
  $("tips").innerHTML =
    `${session.tips.length} / ${GOAL_TIPS}<small>${session.teleops.length > 1 ? "alliance " : ""}TIPs · CELL ${session.sim.cellCount(session.sim.alliance)} in</small>`;
  const all = session.teleops.map((_, k) => k);
  $("robot").innerHTML = all.map(robotBox).join("");
  $("note").textContent = session.teleops
    .map((t, k) => {
      const n = t.status().note;
      return n && session.teleops.length > 1
        ? `${session.slots[k].team}: ${n}`
        : n;
    })
    .filter(Boolean)
    .join(" · ");
  $("readout").innerHTML = all.map(readoutBox).join("");
}

/**
 * The Controllers panel: each robot's driver and operator, each on a gamepad picked here (the start
 * screen), with the connected controller's name. Kept per mode in this browser.
 */
function padsLine(list: (Gamepad | null)[]) {
  const ops = modeSel.value === "two" || modeSel.value === "alliance-ops";
  // The operator's layout shows only when someone runs it.
  $("operator-section").hidden = !ops;
  $("driver-pads").textContent = alliance() ? "one per robot" : "";
  const name = (i: number) =>
    i < 0
      ? ""
      : list[i]
        ? esc(list[i]!.id.replace(/\s*\(.*\)$/, ""))
        : '<span style="color:var(--warn)">not connected</span>';
  const pick = (k: number, role: 0 | 1, value: number) =>
    `<select data-robot="${k}" data-role="${role}">${[-1, 0, 1, 2, 3]
      .map(
        (i) =>
          `<option value="${i}"${i === value ? " selected" : ""}>${i < 0 ? "nobody" : `Gamepad ${i + 1}`}</option>`,
      )
      .join("")}</select>`;
  const a = assignment();
  $("pads").innerHTML =
    `<table>${teams()
      .map((team, k) => {
        const who = alliance() ? `${TEAM_NAMES[team]} ` : "";
        const rows = [
          `<tr><td>${who}driver</td><td>${pick(k, 0, a[k][0])} ${name(a[k][0])}</td></tr>`,
        ];
        if (ops)
          rows.push(
            `<tr><td>${who}operator</td><td>${pick(k, 1, a[k][1])} ${name(a[k][1])}</td></tr>`,
          );
        return rows.join("");
      })
      .join("")}</table>` +
    (ops
      ? ""
      : `<div>${alliance() ? "Each robot has a driver alone" : "Driver only"}: the turret aims (AIM), nobody runs the operator's buttons.</div>`);
  for (const sel of $("pads").querySelectorAll("select"))
    sel.onchange = () => {
      const k = Number(sel.dataset.robot),
        role = Number(sel.dataset.role);
      const next = assignment().map((x) => [...x] as [number, number]);
      next[k][role] = Number(sel.value);
      prefs.assign = { ...prefs.assign, [modeSel.value]: next };
      savePrefs();
      padsKey = "";
      newSession();
    };
}

let lastFrame = performance.now();
let padsKey = "";
function frame(now: number) {
  const dt = Math.min(0.1, Math.max(0, (now - lastFrame) / 1000));
  lastFrame = now;
  const list = [...(navigator.getGamepads?.() ?? [])].filter(
    (g): g is Gamepad => !!g && g.connected,
  );
  const key = list.map((g) => g.id).join("|") + modeSel.value;
  if (key !== padsKey) {
    padsKey = key;
    padsLine(list);
  }
  // Options on either pad starts (or restarts after the results), as Enter does.
  const startBtn = list.some((g) => g.buttons[9]?.pressed);
  if (startBtn && !startWas) {
    if (session.finished) newSession();
    start();
  }
  startWas = startBtn;
  const viewBtn = list.some((g) => g.buttons[8]?.pressed);
  if (viewBtn && !viewWas) cycleCamera();
  viewWas = viewBtn;
  const pad = (i: number) => readPad(list[i] ?? null, file.triggerPressed);
  session.advanceAll(
    dt,
    assignment().map(([d, o]) => ({ driver: pad(d), operator: pad(o) })),
  );
  if (session.finished && !saved) {
    saved = true;
    showResults(session.result());
  }
  view.sync(
    session.sim,
    session.teleops.map((t, k) => ({
      team: session.slots[k].team,
      turretDeg: t.turretDeg,
    })),
    true,
  );
  hud();
  requestAnimationFrame(frame);
}

function cycleCamera() {
  const i = CAMERAS.indexOf(view.mode);
  view.mode = CAMERAS[(i + 1) % CAMERAS.length];
  camSel.value = view.mode;
  savePrefs();
}

async function main() {
  try {
    await RAPIER.init();
    const loaded = await loadControls();
    file = loaded.file;
    $("controls-source").textContent =
      `From biobuzz's controls export (${loaded.from.includes("raw.githubusercontent") ? "GitHub, master" : "this site's mirror"}): ${file.about}`;
  } catch (e) {
    fatal((e as Error).message);
    return;
  }
  showControls();
  view = new DrillView(
    $("canvas") as HTMLCanvasElement,
    (m) => ($("progress").textContent = m ?? ""),
    PRESETS[20245].frameIn * IN,
  );
  view.mode = (camSel.value as CameraMode) || "driver";
  newSession();
  $("start").onclick = () => start();
  $("reset").onclick = () => newSession();
  for (const sel of [teamSel, modeSel, tipSel])
    sel.onchange = () => {
      savePrefs();
      padsKey = "";
      newSession();
    };
  camSel.onchange = () => {
    view.mode = camSel.value as CameraMode;
    savePrefs();
  };
  addEventListener("keydown", (e) => {
    if ((e.target as HTMLElement).closest("select, input")) return;
    if (e.key === "Enter") start();
    else if (e.key === "r" || e.key === "R") newSession();
    else if (e.key === "c" || e.key === "C") cycleCamera();
  });
  requestAnimationFrame(frame);
}

void main();
