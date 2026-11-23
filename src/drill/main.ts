/**
 * The driver drill page (drill/index.html): a 2:00 TeleOp, solo, toward 7 TIPs, on our robot's
 * controls and numbers. Gamepad 1 is the driver, gamepad 2 the operator.
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
import { DrillSession, GOAL_TIPS, type RunResult } from "./session";
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
      }),
    );
  } catch {
    /* not kept */
  }
}

const teamSel = $<HTMLSelectElement>("team");
const modeSel = $<HTMLSelectElement>("mode");
const camSel = $<HTMLSelectElement>("camera");
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

function newSession() {
  session = new DrillSession(
    RAPIER,
    file,
    Number(teamSel.value) as TeamNumber,
    modeSel.value as "two" | "driver",
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
  const p = PRESETS[Number(teamSel.value) as TeamNumber];
  $("numbers").innerHTML = `<table>
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

function showHistory(list: StoredRun[] = loadHistory()) {
  const team = Number(teamSel.value);
  const mine = list
    .filter((r) => r.team === team)
    .slice(-8)
    .reverse();
  const best = bestRun(list, team);
  if (!mine.length) {
    $("history").textContent = `No ${team} runs on this laptop yet.`;
    return;
  }
  $("history").innerHTML =
    (best
      ? `<p>Best: <b>${best.tips} TIPs</b>${best.goalAtS != null ? `, 7th at ${clock(best.goalAtS)}` : ""}, median cycle ${f1(best.medianCycleS ?? NaN)} s (${best.mode === "two" ? "two players" : "driver only"}, ${best.date.slice(0, 10)})</p>`
      : "") +
    `<table>${mine.map((r) => `<tr><td>${r.date.slice(5, 16).replace("T", " ")}</td><td>${r.tips} TIPs · ${r.cycles} cycles · med ${f1(r.medianCycleS ?? NaN)} s</td></tr>`).join("")}</table>`;
}

function showResults(r: RunResult) {
  const list = saveRun(summarize(r));
  showHistory(list);
  const best = bestRun(list, r.team, r.mode);
  const isBest = best && best.date === r.date;
  const s = session.readout.stats();
  const rows = r.cycles
    .map(
      (c) =>
        `<tr><td>${c.n}</td><td>${f1(c.atS)}</td><td class="${c.cycleS <= BUDGET_S && c.balls >= BUDGET_PIECES ? "goal" : ""}">${f1(c.cycleS)}</td><td>${f1(c.toPiecesS)}</td><td>${f1(c.pickUpS)}</td><td>${f1(c.driveLoadedS)}</td><td>${f1(c.spinUpAimS)}</td><td>${f1(c.feedS)}</td><td>${c.balls}${c.emptyFeeds ? ` (+${c.emptyFeeds} empty)` : ""}</td></tr>`,
    )
    .join("");
  const picks = r.pickUps
    .map((p) => `${f1(p.s)} s (${p.pieces} in${p.full ? "" : ", fired short"})`)
    .join(" · ");
  $("results-card").innerHTML = `
    <h2>${r.tips >= GOAL_TIPS ? `<span class="goal">${r.tips} TIPs: goal!</span>` : `<span class="miss">${r.tips} of ${GOAL_TIPS} TIPs</span>`}${isBest ? ' <span class="goal">· new best</span>' : ""}</h2>
    <p>${PRESETS[r.team].name} ${r.team}, ${r.mode === "two" ? "driver + operator" : "driver only"}. ${r.balls} balls launched${r.goalAtS != null ? `; the 7th TIP settled at ${clock(r.goalAtS)} of 2:00` : ""}.
    TIPs settled at ${r.tipTimes.map((t) => f1(t)).join(", ") || "–"} s.</p>
    <p>Cycles: best ${f1(s.bestCycleS)} s, median ${f1(s.medianCycleS)} s against the ${BUDGET_S} s budget with ${BUDGET_PIECES} pieces. Pick-ups: best ${f1(s.bestPickUpS)} s, median ${f1(s.medianPickUpS)} s.</p>
    <table><tr><th>#</th><th>at</th><th>cycle</th><th>to pieces</th><th>pick up</th><th>drive loaded</th><th>spin-up and aim</th><th>feed</th><th>balls</th></tr>${rows || '<tr><td colspan="9">No volley this run.</td></tr>'}</table>
    <p class="dim">Pick-ups: ${picks || "–"}</p>
    ${best && !isBest ? `<p class="dim">Best ${r.mode === "two" ? "two-player" : "driver-only"} run on this laptop: ${best.tips} TIPs${best.goalAtS != null ? `, 7th at ${clock(best.goalAtS)}` : ""}, median cycle ${f1(best.medianCycleS ?? NaN)} s.</p>` : ""}
    <p><button class="primary" id="again">Run again (Options)</button></p>`;
  $("results").hidden = false;
  $("again").onclick = () => {
    newSession();
    start();
  };
}

function hud() {
  const st = session.teleop.status();
  $("clock").innerHTML =
    `${clock(Math.ceil(session.remainingS))}<small>${session.finished ? "ended" : session.t > 0 ? "TeleOp" : "press Options to start"}</small>`;
  $("tips").innerHTML =
    `${session.tips.length} / ${GOAL_TIPS}<small>TIPs · CELL ${session.sim.cellCount(session.sim.alliance)} in</small>`;
  $("robot").innerHTML =
    `${st.nearCellUp ? '<b style="color:var(--ok)">OUR CELL UP</b>' : '<b style="color:var(--warn)">OUR CELL DOWN: LOAD 4</b>'} <span class="dim">(${st.nearCell} end)</span><br>
    Turret <span class="tag ${st.turretMode === "AIM" ? "aim" : "locked"}">${st.turretMode}</span> ${st.insideArc ? "" : '<span style="color:var(--warn)">aim behind the arc</span>'}<br>
    Lane ${"●".repeat(st.lane)}${"○".repeat(Math.max(0, session.preset.laneCapacity - st.lane))} · launcher ${st.launcher}${st.gateOpen ? " · <b>feeding</b>" : ""}<br>
    ${st.routine ?? (st.arcTurning ? "arc turn" : st.chassisAiming ? "turning onto the CELL" : st.slow ? "slow" : "&nbsp;")}${st.aimTrimDeg ? ` · aim trim ${st.aimTrimDeg.toFixed(1)}°` : ""}`;
  $("note").textContent = st.note;
  const r = session.readout,
    p = r.pickUps.at(-1),
    c = r.cycles.at(-1),
    s = r.stats();
  $("readout").innerHTML = [
    p
      ? `<div class="big ${p.full ? "ok" : "warn"}">PICK-UP ${f1(p.s)} s (${p.pieces} in)</div>`
      : "",
    c
      ? `<div class="big ${c.cycleS <= BUDGET_S && c.balls >= BUDGET_PIECES ? "ok" : ""}">CYCLE ${f1(c.cycleS)} s · ${c.balls} ball${c.balls === 1 ? "" : "s"}</div><div>to pieces ${f1(c.toPiecesS)} | pick ${f1(c.pickUpS)} | loaded ${f1(c.driveLoadedS)} | spin+aim ${f1(c.spinUpAimS)} | feed ${f1(c.feedS)}${c.emptyFeeds ? ` · +${c.emptyFeeds} empty feed${c.emptyFeeds === 1 ? "" : "s"}` : ""}${c.earlyPresses ? ` · ${c.earlyPresses} early press${c.earlyPresses === 1 ? "" : "es"}` : ""}</div>`
      : "",
    `<div class="dim">${r.cycles.length ? `cycle best ${f1(s.bestCycleS)} · median ${f1(s.medianCycleS)} s (${r.cycles.length})` : "PRACTICE: fire a volley to time a cycle"}${r.pickUps.length ? ` · pick-up best ${f1(s.bestPickUpS)} · median ${f1(s.medianPickUpS)}` : ""}</div>`,
  ].join("");
}

function padsLine(list: (Gamepad | null)[]) {
  const two = modeSel.value === "two";
  const names = [0, 1].map(
    (i) => list[i]?.id.replace(/\s*\(.*\)$/, "") ?? null,
  );
  $("pads").innerHTML =
    `<div>Gamepad 1 (driver): ${names[0] ? esc(names[0]) : '<span style="color:var(--warn)">not connected</span>'}</div>` +
    (two
      ? `<div>Gamepad 2 (operator): ${names[1] ? esc(names[1]) : '<span style="color:var(--warn)">not connected: the operator\'s buttons do nothing</span>'}</div>`
      : "<div>Driver only: the turret aims (AIM), nobody runs the operator's buttons.</div>");
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
  const driver = readPad(list[0] ?? null, file.triggerPressed);
  const operator = readPad(list[1] ?? null, file.triggerPressed);
  session.advance(dt, driver, operator);
  if (session.finished && !saved) {
    saved = true;
    showResults(session.result());
  }
  view.sync(session.sim, session.teleop.turretDeg, true);
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
  for (const sel of [teamSel, modeSel])
    sel.onchange = () => {
      savePrefs();
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
