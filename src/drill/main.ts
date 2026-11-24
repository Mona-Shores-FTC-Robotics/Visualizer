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
import {
  loadPeople,
  rowFromRun,
  rowFromStored,
  savePeople,
  sendRows,
  sheetUrl,
} from "./stats";
import { PRESETS, IN, type TeamNumber } from "./presets";
import { BUDGET_PIECES, BUDGET_S } from "./readout";
import {
  DrillSession,
  GOAL_TIPS,
  TEAM_NAMES,
  TIP_TIMINGS,
  HUMAN_PLAYERS,
  type HumanPlayerKind,
  type TipTiming,
  type DrillMode,
  type OpponentSkill,
  type Population,
  type OpeningKind,
  type RobotRunResult,
  type RunResult,
} from "./session";
import { DrillView, CAMERAS, type CameraMode } from "./view";
import {
  loadAutoIndex,
  loadAutoTrace,
  partnerAutoFor,
  type AutoTrace,
} from "./fullMatch";
import {
  PadBinder,
  PadDecoder,
  connectedPads,
  type DecodedPad,
} from "./gamepads";

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
      humanPlayer?: string;
      match?: string;
      population?: string;
      opening?: string;
      nectar?: string;
      cornerWheels?: string;
      look?: string;
      labels?: string;
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
        humanPlayer: hpSel.value,
        match: matchSel.value,
        population: popSel.value,
        opening: openSel.value,
        nectar: nectarSel.value,
        cornerWheels: wheelSel.value,
        look: lookSel.value,
        labels: labelSel.value,
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
const hpSel = $<HTMLSelectElement>("human-player");
/** Full Match: "" for the 2:00 drill, else the Auto to play first (public/drill/autos/). */
const matchSel = $<HTMLSelectElement>("match");
/** Who else is on the field: empty, or a match (dead partner, two planner opponents). */
const popSel = $<HTMLSelectElement>("population");
function population(): Population {
  const v = popSel.value;
  if (v === "empty") return { kind: "empty" };
  return {
    kind: "match",
    skill: v === "random" ? "random" : (Number(v) as OpponentSkill),
  };
}
/** The 2:00 drill's opening: R-Solo's 2-TIP or 1-TIP outcome, or either one by turns. */
const openSel = $<HTMLSelectElement>("opening");
/** Our robots' NECTAR gate: "pollen" rejects every NECTAR (on for now), "ours" only the other alliance's. */
const nectarSel = $<HTMLSelectElement>("nectar");
/** Corner wheels on the intake (an experiment): "off" is the robot as it is. */
const wheelSel = $<HTMLSelectElement>("corner-wheels");
const traces = new Map<string, AutoTrace>();
hpSel.innerHTML = HUMAN_PLAYERS.map(
  (t) => `<option value="${t.value}">${t.label}</option>`,
).join("");
if (prefs.humanPlayer) hpSel.value = prefs.humanPlayer;
if (prefs.team) teamSel.value = prefs.team;
if (prefs.mode) modeSel.value = prefs.mode;
if (prefs.camera) camSel.value = prefs.camera;
if (prefs.opening) openSel.value = prefs.opening;
if (!openSel.value) openSel.value = "varied";
if (prefs.nectar) nectarSel.value = prefs.nectar;
if (!nectarSel.value) nectarSel.value = "pollen";
if (prefs.cornerWheels) wheelSel.value = prefs.cornerWheels;
if (!wheelSel.value) wheelSel.value = "off";
/** How our robots are drawn: the toy (as they look in match video) or the team's CAD. */
const lookSel = $<HTMLSelectElement>("robot-look");
/** The floating team-number labels: off by default (the toy's number plates name the robots). */
const labelSel = $<HTMLSelectElement>("labels");
if (prefs.look) lookSel.value = prefs.look;
if (!lookSel.value) lookSel.value = "toy";
if (prefs.labels) labelSel.value = prefs.labels;
if (!labelSel.value) labelSel.value = "off";

let file: ControlsFile;
let session: DrillSession;
let view: DrillView;
let saved = false;
let startWas = false;
let viewWas = false;
let driveBtnWas = false;

// ---------- layout: the side panel and drive mode ----------

/** The side panel's state the user chose (Setup ⚙), or null to follow the run: closed while driving. */
let panelChoice: boolean | null = null;
let wasRunning = false;
const running = () => {
  const ph = session?.phase;
  return !!ph && ph !== "pre" && ph !== "ended";
};
function layout() {
  const r = running();
  // A run starting or ending hands the panel back to the run's own rule.
  if (r !== wasRunning) {
    wasRunning = r;
    panelChoice = null;
  }
  const open =
    !document.body.classList.contains("drive") && (panelChoice ?? !r);
  document.body.classList.toggle("panel-closed", !open);
  $("panel-btn").setAttribute("aria-expanded", String(open));
}
function togglePanel() {
  panelChoice = document.body.classList.contains("panel-closed");
  layout();
}

/**
 * Drive mode: only the field, the robots and a minimal HUD (clock, TIPs, lane, launcher, last cycle),
 * full screen where the browser allows it (a key or a click does; a controller button can't, so
 * from the controller it fills the window). F, the button, or the controller's touchpad toggle it;
 * leaving full screen (Esc) leaves it too.
 */
function setDrive(on: boolean) {
  document.body.classList.toggle("drive", on);
  if (on && !document.fullscreenElement)
    void document.documentElement.requestFullscreen?.().catch(() => {});
  if (!on && document.fullscreenElement)
    void document.exitFullscreen?.().catch(() => {});
  layout();
}
const toggleDrive = () => setDrive(!document.body.classList.contains("drive"));
document.addEventListener("fullscreenchange", () => {
  if (!document.fullscreenElement && document.body.classList.contains("drive"))
    setDrive(false);
});

/** Drive mode's HUD line: the lane, the launcher, and the last cycle. */
function miniBox(): string {
  const t = session.teleops[0];
  if (!t) return "";
  const st = t.status(),
    cap = session.presets[0].laneCapacity,
    c = session.readouts[0].cycles.at(-1);
  const launcher =
    st.launcher === "AT SPEED"
      ? '<span class="ready">READY</span>'
      : st.launcher === "SPINNING UP"
        ? '<span class="spinning">SPINNING</span>'
        : '<span class="idle">IDLE</span>';
  return `<div><span class="lane">${"●".repeat(st.lane)}${"○".repeat(Math.max(0, cap - st.lane))}</span><small>lane</small></div>
    <div>${launcher}<small>launcher</small></div>
    <div>${c ? `${f1(c.cycleS)} s` : "–"}<small>last cycle</small></div>`;
}

function fatal(msg: string) {
  $("fatal").hidden = false;
  $("fatal-card").innerHTML =
    `<h2>The drill cannot start</h2><p>${esc(msg)}</p><p class="dim">The controls come from biobuzz (TeamCode/cheat-sheets/controls.json). Check the connection and reload.</p>`;
}

const alliance = () => modeSel.value.startsWith("alliance");

/** The roles this mode has, in the order controllers bind to them: "robot:role". */
function roles(): string[] {
  const mode = modeSel.value;
  const ops = mode === "two" || mode === "alliance-ops";
  return teams().flatMap((_, k) =>
    ops ? [`${k}:driver`, `${k}:operator`] : [`${k}:driver`],
  );
}
const hasOperator = (k: number) => roles().includes(`${k}:operator`);
const roleName = (role: string) => {
  const [k, r] = role.split(":");
  const who = alliance() ? `${TEAM_NAMES[teams()[Number(k)]]} ` : "";
  return `${who}${r}`;
};

/** Robot 1 is the team picked under Robot; in an alliance its partner is the other. */
function teams(): TeamNumber[] {
  const first = Number(teamSel.value) as TeamNumber;
  return alliance() ? [first, first === 20245 ? 19429 : 20245] : [first];
}

const PHASE_LABEL: Record<DrillSession["phase"], string> = {
  pre: "press Options to start",
  auto: "AUTO",
  transition: "transition",
  teleop: "TeleOp",
  ended: "ended",
};

/** The Auto the 2:00 drill opens after: ours, as the mentor asked. */
const OPENING_AUTO = "r-solo";

/** Loads an Auto's trace once; "" (the 2:00 drill) needs none. */
async function ensureTrace(auto: string) {
  if (!auto || traces.has(auto)) return;
  try {
    traces.set(auto, await loadAutoTrace(auto));
  } catch (e) {
    $("progress").textContent =
      `The Auto ${auto} did not load: ${(e as Error).message}`;
  }
}

function newSession() {
  const mode = modeSel.value as DrillMode;
  session = new DrillSession(
    RAPIER,
    file,
    teams().map((team, k) => ({
      team,
      driverOnly: !hasOperator(k),
    })),
    mode,
    undefined,
    tipSel.value as TipTiming,
    hpSel.value as HumanPlayerKind,
    population(),
  );
  session.pollenOnly = nectarSel.value !== "ours";
  session.cornerWheels = wheelSel.value === "on";
  const trace = traces.get(matchSel.value);
  if (matchSel.value && trace) session.playAuto(trace);
  else {
    // The 2:00 drill opens on the field as our R-Solo leaves it, our robot in our LOADING ZONE
    // (the mentor, 23 Nov 2026); should its trace not load, after a 1-TIP Auto.
    const opening = traces.get(OPENING_AUTO);
    if (opening) {
      session.openingAuto = opening;
      session.openingKind = openSel.value as OpeningKind;
    } else session.opensAfterAuto = true;
  }
  // A match field's dead partner stands at the start of the Auto it would run beside ours.
  // Beside R-Solo the partner keeps out of the way, in our alliance wall's left corner; beside
  // another Auto it stands at its own Auto's start.
  const ours = matchSel.value || OPENING_AUTO;
  if (ours === "r-solo") session.placeDeadPartnerInCorner();
  const partner = ours === "r-solo" ? null : partnerAutoFor(ours);
  const partnerTrace = partner ? traces.get(partner) : undefined;
  if (partnerTrace) session.placeDeadPartner(partnerTrace);
  $("start").textContent = session.playback
    ? "Start the match (Options)"
    : "Start 2:00 (Options)";
  saved = false;
  $("results").hidden = true;
  showNumbers();
  showHistory();
  Object.assign(window as unknown as Record<string, unknown>, {
    __drill: { session, file, binder },
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
    <tr><td>Top speed (forward / 45° / sideways)</td><td>${p.envelope.topInPerS.join(" / ")} in/s</td></tr>
    <tr><td>Acceleration (forward / 45° / sideways)</td><td>${p.envelope.accelInPerS2.join(" / ")} in/s²</td></tr>
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

/** Who is playing, as typed on this laptop (kept for next time). */
const driverIn = $<HTMLInputElement>("driver");
const operatorIn = $<HTMLInputElement>("operator");
function people() {
  return { driver: driverIn.value.trim(), operator: operatorIn.value.trim() };
}
function showPeople() {
  const p = loadPeople();
  if (!driverIn.value) driverIn.value = p.driver;
  if (!operatorIn.value) operatorIn.value = p.operator;
  $("people").innerHTML = p.names
    .map((n) => `<option value="${esc(n)}"></option>`)
    .join("");
}
for (const el of [driverIn, operatorIn])
  el.onchange = () => {
    savePeople(driverIn.value, operatorIn.value);
    showPeople();
  };

/** The team sheet's line: where runs go, and what is waiting to. */
function sheetStatus(
  res?: { sent: number; waiting: number; url: string },
  target = "sheet-status",
) {
  const el = document.getElementById(target);
  if (!el) return;
  const url = res?.url ?? sheetUrl();
  if (!url) {
    el.textContent = `No team sheet set up on this laptop yet: runs are kept here${res?.waiting ? ` (${res.waiting} waiting)` : ""} and go once it is (docs/drill-stats.md).`;
    return;
  }
  el.textContent = res
    ? res.waiting
      ? `Couldn't reach the team sheet: ${res.waiting} run${res.waiting === 1 ? "" : "s"} waiting, sent with the next run.`
      : res.sent
        ? `Sent to the team sheet (${res.sent} run${res.sent === 1 ? "" : "s"}).`
        : "Nothing new to send to the team sheet."
    : "Runs go to the team sheet when they finish.";
}

function showResults(r: RunResult) {
  const list = saveRun(summarize(r, people()));
  void sendRows([rowFromRun(r, people())]).then((res) => {
    sheetStatus(res, "results-sheet");
    sheetStatus(res);
  });
  showHistory(list);
  const best = bestRun(list, r.team, r.mode, r.tipTiming, r.auto?.name ?? "");
  const total = r.tips + (r.auto?.tips ?? 0) + (r.openingTips ?? 0);
  const isBest = best && best.date === r.date;
  const who = r.mode.startsWith("alliance")
    ? `Alliance: ${r.robots.map((x) => TEAM_NAMES[x.team]).join(" and ")}, ${r.mode === "alliance" ? "a driver each" : "a driver and an operator each"}`
    : `${TEAM_NAMES[r.team]}, ${r.mode === "two" ? "driver + operator" : "driver only"}`;
  const timingLabel = TIP_TIMINGS.find((t) => t.value === r.tipTiming)?.label;
  const hpLabel = HUMAN_PLAYERS.find((t) => t.value === r.humanPlayer)?.label;
  const rejects = r.robots.reduce((a, x) => a + x.rejects, 0);
  const nectarLine = `<p>NECTAR (${hpLabel}): ${r.nectarEntered} of 5 entered, ${r.robots.reduce((a, x) => a + x.nectarLaunched, 0)} fired${rejects ? `; ${rejects} of the other alliance's rejected at the lane` : ""}.</p>`;
  const robots = r.mode.startsWith("alliance")
    ? r.robots
        .map(
          (x) =>
            `<h3>${TEAM_NAMES[x.team]} <span class="dim">· the ${x.end} end · ${x.balls} balls · ${x.volleys} volleys, ${x.volleysOffEnd} off its end, ${x.volleysAtDown} at a down CELL · ${x.nectarLaunched} NECTAR fired</span></h3>${cycleTable(x)}`,
        )
        .join("")
    : cycleTable(r.robots[0]);
  $("results-card").innerHTML = `
    <h2>${total >= GOAL_TIPS ? `<span class="goal">${total} TIPs: goal!</span>` : `<span class="miss">${total} of ${GOAL_TIPS} TIPs</span>`}${isBest ? ' <span class="goal">· new best</span>' : ""}</h2>
    ${r.auto ? `<p><b>Full match, ${esc(r.auto.name)}:</b> AUTO ${r.auto.tips} TIP${r.auto.tips === 1 ? "" : "s"} + TeleOp ${r.tips} = <b>${total}</b>, 7 ${total >= GOAL_TIPS ? "reached" : "not reached"}. <span class="dim">The AUTO is the Java AutoSim's typical run (seed ${r.auto.seed}, design "${esc(r.auto.design ?? "?")}").</span></p>` : ""}
    ${r.openingTips ? `<p>${r.openingAuto ? `Opened on ${esc(r.openingAuto)}'s ${r.openingTips}-TIP outcome (AUTO: ${r.openingTips} TIP${r.openingTips === 1 ? "" : "s"}${r.openingCell ? `, ${r.openingCell} in CELL` : ""}), our robot in our LOADING ZONE` : `Opened after a ${r.openingTips}-TIP Auto (our 4 preloads tipped our CELL before 2:00)`}: AUTO ${r.openingTips} + TeleOp ${r.tips} = <b>${total}</b>, 7 ${total >= GOAL_TIPS ? "reached" : "not reached"}.</p>` : ""}
    <p>${who}, ${timingLabel}${r.pollenOnly ? ", POLLEN only (every NECTAR rejected at the intake)" : ""}${r.cornerWheels ? ", corner wheels on" : ""}. ${r.balls} balls launched${r.goalAtS != null ? `; the 7th TIP settled at ${clock(r.goalAtS)} of 2:00` : ""}.
    TIPs settled at ${r.tipTimes.map((t) => f1(t)).join(", ") || "–"} s.</p>
    ${r.opponents ? `<p>Opponents (planner, ${r.opponents.skill}-TIP skill): ${r.opponents.tips} TIP${r.opponents.tips === 1 ? "" : "s"}. ${session.deadPartnerAt ? ` Our partner stood dead at ${esc(session.deadPartnerAt)}.` : ""}</p>` : ""}
    ${nectarLine}
    ${robots}
    ${best && !isBest ? `<p class="dim">Best ${modeName(r.mode)} run on this laptop: ${best.tips} TIPs${best.goalAtS != null ? `, 7th at ${clock(best.goalAtS)}` : ""}, median cycle ${f1(best.medianCycleS ?? NaN)} s.</p>` : ""}
    <p class="dim">${esc(people().driver || "No driver named")}${people().operator ? ` with ${esc(people().operator)} operating` : ""} · <span id="results-sheet">Sending to the team sheet…</span></p>
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
    Lane ${"●".repeat(st.lane)}${"○".repeat(Math.max(0, session.presets[k].laneCapacity - st.lane))}${session.teleops[k].rejectAllNectar ? ' <span class="dim">POLLEN only</span>' : ""} · launcher ${st.launcher}${st.gateOpen ? " · <b>feeding</b>" : ""}<br>
    ${st.routine ?? (st.arcTurning ? "arc turn" : st.chassisAiming ? "turning onto the CELL" : st.slow ? "slow" : "&nbsp;")}${st.aimTrimDeg ? ` · aim trim ${st.aimTrimDeg.toFixed(1)}°` : ""}${st.nectarGate ? `<br><span style="color:var(--warn)">${st.nectarGate}</span>` : ""}</div>`;
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

/** The human player: NECTAR left, and what they wait for, in the playbook's words. */
function humanPlayerBox() {
  const hp = session.hp;
  if (!hp) {
    const left = session.sim.stash[session.sim.alliance];
    return `<div class="readout-box"><div><b>Human player</b> <span class="dim">NCSSM's</span></div><div>NECTAR ${"●".repeat(left)}${"○".repeat(Math.max(0, 5 - left))}</div></div>`;
  }
  const v = hp.view(session.remainingS, session.tips.length);
  return `<div class="readout-box"><div><b>Human player</b> <span class="dim">our playbook</span></div><div>NECTAR ${"●".repeat(v.left)}${"○".repeat(Math.max(0, 5 - v.left))}${v.owed ? ` · ${v.owed} may go in` : ""}</div><div class="dim">${esc(v.waiting) || "&nbsp;"}</div></div>`;
}

/** Which opening this run had, once it has started: "AUTO: 1 TIP, 6 in CELL" or "AUTO: 2 TIPs". */
function openingLabel(): string {
  if (session.playback || !session.openingAuto || session.phase === "pre")
    return "";
  const n = session.openingTips;
  return `AUTO: ${n} TIP${n === 1 ? "" : "s"}${session.openingCell ? `, ${session.openingCell} in CELL` : ""}`;
}

function hud() {
  $("clock").innerHTML =
    `${clock(Math.ceil(session.remainingS))}<small>${PHASE_LABEL[session.phase]}${session.playback && session.phase !== "teleop" && session.phase !== "ended" ? ` · ${esc(session.playback.trace.auto)}` : ""}</small>`;
  const autoTips = session.playback
    ? session.totalTips - session.tips.length
    : 0;
  $("tips").innerHTML =
    `${session.totalTips} / ${GOAL_TIPS}<small>${session.teleops.length > 1 ? "alliance " : ""}TIPs<span class="detail">${session.playback ? ` (AUTO ${autoTips})` : ""}${openingLabel() ? ` · ${openingLabel()}` : ""}${session.replayPieces ? "" : ` · CELL ${session.sim.cellCount(session.sim.alliance)} in`}</span></small>`;
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
  $("readout").innerHTML = all.map(readoutBox).join("") + humanPlayerBox();
  if (document.body.classList.contains("drive"))
    $("mini").innerHTML = miniBox();
}

/**
 * The Controllers panel, the start screen: each role binds to the controller that presses Cross
 * (A on an Xbox pad) while it waits, in order. A controller that never presses is never used, so
 * another device in the browser's list (a virtual pad, a wheel) cannot drive the robot.
 */
function padsLine(list: Gamepad[]) {
  const ops = roles().some((r) => r.endsWith(":operator"));
  // The operator's layout shows only when someone runs it.
  $("operator-section").hidden = !ops;
  $("driver-pads").textContent = alliance() ? "one per robot" : "";
  const waiting = binder.waiting();
  const rows = roles()
    .map((role) => {
      const g = binder.boundPad(role, list);
      const cell = g
        ? `${esc(g.id.replace(/\s*\(.*\)$/, ""))} <span class="dim">(index ${g.index})</span>`
        : role === waiting
          ? '<b style="color:var(--warn)">press Cross (A) on this controller</b>'
          : '<span class="dim">waiting</span>';
      return `<tr><td>${roleName(role)}</td><td>${cell}</td></tr>`;
    })
    .join("");
  const idle = list.filter((g) => !binder.roleOf(g)).length;
  $("pads").innerHTML =
    `<table>${rows}</table>` +
    (idle
      ? `<div class="dim">${idle} other controller${idle === 1 ? "" : "s"} connected, not used until one presses Cross (A).</div>`
      : "") +
    (ops
      ? ""
      : `<div>${alliance() ? "Each robot has a driver alone" : "Driver only"}: the turret aims (AIM), nobody runs the operator's buttons.</div>`) +
    '<p><button id="rebind" type="button">Bind again</button></p>';
  $("rebind").onclick = () => {
    binder.clear();
    padsKey = "";
  };
}

let lastFrame = performance.now();
let padsKey = "";
let decoder: PadDecoder;
const binder = new PadBinder();
let debugAt = 0;

/**
 * The live readout under Controllers: each pad's mapping, raw axes and buttons, and what the
 * drill reads from them (drive, turn, L2, R2), so a pad that drives on its own shows why.
 */
function padDebug(list: Gamepad[], read: DecodedPad[]) {
  // Each robot's pose, so a creep with the sticks let go shows here as well as on the field.
  const poses = session.teleops
    .map((_, k) => {
      const v = session.sim.view(k),
        p = v.robot.translation();
      const who = session.teleops.length > 1 ? `${session.slots[k].team} ` : "";
      return `<div><code>${who}pose x ${(p.x / IN).toFixed(1)} in, y ${(-p.z / IN).toFixed(1)} in, heading ${((v.heading * 180) / Math.PI).toFixed(1)}°</code></div>`;
    })
    .join("");
  if (!list.length) {
    $("pad-debug").innerHTML = poses;
    return;
  }
  const f = (v: number) => (v >= 0 ? " " : "") + v.toFixed(2);
  $("pad-debug").innerHTML =
    poses +
    list
      .map((g, i) => {
        const d = read[i];
        const pressed = g.buttons
          .map((b, k) => (b.pressed || b.value > 0.5 ? k : -1))
          .filter((k) => k >= 0);
        const warn = d.standard
          ? ""
          : `<div style="color:var(--warn)">Not the browser's standard mapping ("${esc(g.mapping || "none")}"). The drill read the sticks and triggers by where they rest (sticks: axes ${d.axisOf.lx}, ${d.axisOf.ly}, ${d.axisOf.rx}; L2 ${d.axisOf.l2}, R2 ${d.axisOf.r2}); its buttons may be off. Chrome or Edge, or a USB cable, gives the standard mapping.</div>`;
        const role = binder.roleOf(g);
        return `<div class="pad-debug"><b>Index ${g.index}</b> · ${role ? `<b>${roleName(role)}</b>` : '<span class="dim">not bound: ignored</span>'} <span class="dim">${esc(g.id)} · mapping ${esc(g.mapping || "none")}</span>${warn}
        <div><code>axes ${g.axes.map(f).join(" ")}</code></div>
        <div><code>buttons ${pressed.join(" ") || "–"}</code></div>
        <div><code>drill: drive ${f(d.lx)} ${f(d.ly)} turn ${f(d.rx)} L2 ${d.l2.toFixed(2)} R2 ${d.r2.toFixed(2)}</code></div></div>`;
      })
      .join("");
}
function frame(now: number) {
  const dt = Math.min(0.1, Math.max(0, (now - lastFrame) / 1000));
  lastFrame = now;
  // Controllers only, in the browser's order: a pad's motion sensors are not a pad.
  const list = connectedPads([...(navigator.getGamepads?.() ?? [])]);
  binder.setRoles(roles());
  binder.update(list);
  const read = list.map((g) => decoder.read(g));
  const key =
    list.map((g) => `${g.index}${g.id}${binder.roleOf(g) ?? ""}`).join("|") +
    modeSel.value;
  if (key !== padsKey) {
    padsKey = key;
    padsLine(list);
  }
  // Options on a bound controller starts (or restarts after the results), as Enter does.
  const bound = list.map((g) => !!binder.roleOf(g));
  const startBtn = read.some((d, i) => bound[i] && d.options);
  if (startBtn && !startWas) {
    if (session.finished) newSession();
    start();
  }
  startWas = startBtn;
  // The touchpad's click (button 17 in the standard mapping) toggles drive mode.
  const driveBtn = list.some((g, i) => bound[i] && !!g.buttons[17]?.pressed);
  if (driveBtn && !driveBtnWas) toggleDrive();
  driveBtnWas = driveBtn;
  const viewBtn = read.some((d, i) => bound[i] && d.share);
  if (viewBtn && !viewWas) cycleCamera();
  viewWas = viewBtn;
  const padOf = (role: string) => {
    const g = binder.padFor(role, list);
    return g ? read[list.indexOf(g)] : decoder.read(null);
  };
  if (now - debugAt > 200) {
    debugAt = now;
    padDebug(list, read);
  }
  session.advanceAll(
    dt,
    teams().map((_, k) => ({
      driver: padOf(`${k}:driver`),
      operator: padOf(`${k}:operator`),
    })),
  );
  if (session.finished && !saved) {
    saved = true;
    showResults(session.result());
  }
  view.sync(
    session.sim,
    // Ours (driven), our dead partner (our other robot), and the opponents (team 0: a blue box).
    session.sim.robots.map((r, k) => {
      const t = session.teleops[k];
      if (t)
        return {
          team: session.slots[k].team,
          turretDeg: t.turretDeg,
          // During a full match's AUTO the TeleOp is not running: after PLAY the light is green
          // when the lane is full and off otherwise (no fire held, no arc).
          light:
            session.phase === "auto" || session.phase === "transition"
              ? r.carried.length >= session.presets[k].laneCapacity
                ? "green"
                : null
              : t.light.colour(session.t * 1000),
          cornerWheels: t.cornerWheels,
          stickDeg: k === 0 ? session.replayStickDeg : null,
          cornerWheelsTurning: t.cornerWheelsRunning,
        };
      return r.alliance === session.sim.alliance
        ? {
            team: session.slots[0].team === 20245 ? 19429 : 20245,
            turretDeg: 0,
            aim: false,
          }
        : { team: 0, turretDeg: 0, aim: false };
    }),
    true,
    session.replayPieces,
  );
  hud();
  layout();
  requestAnimationFrame(frame);
}

function cycleCamera() {
  const i = CAMERAS.indexOf(view.mode);
  view.mode = CAMERAS[(i + 1) % CAMERAS.length];
  camSel.value = view.mode;
  savePrefs();
}

async function main() {
  showPeople();
  // Anything that could not go last time goes now.
  void sendRows([]).then((res) => sheetStatus(res));
  $("send-saved").onclick = () => {
    $("sheet-status").textContent = "Sending this laptop's saved runs…";
    void sendRows(loadHistory().map((x) => rowFromStored(x))).then((res) =>
      sheetStatus(res),
    );
  };
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
  decoder = new PadDecoder(file.triggerPressed);
  $("rezero").onclick = () =>
    decoder.rezero(connectedPads([...(navigator.getGamepads?.() ?? [])]));
  view = new DrillView(
    $("canvas") as HTMLCanvasElement,
    (m) => ($("progress").textContent = m ?? ""),
    PRESETS[20245].frameIn * IN,
  );
  view.mode = (camSel.value as CameraMode) || "driver";
  view.look = lookSel.value === "cad" ? "cad" : "toy";
  view.labels = labelSel.value === "on";
  await ensureTrace(OPENING_AUTO);
  await ensureTrace(partnerAutoFor(OPENING_AUTO) ?? "");
  newSession();
  $("start").onclick = () => start();
  $("reset").onclick = () => newSession();
  if (prefs.population) popSel.value = prefs.population;
  if (!popSel.value) popSel.value = "empty";
  for (const sel of [
    teamSel,
    modeSel,
    tipSel,
    hpSel,
    popSel,
    openSel,
    nectarSel,
    wheelSel,
  ])
    sel.onchange = () => {
      savePrefs();
      padsKey = "";
      newSession();
    };
  matchSel.onchange = async () => {
    savePrefs();
    await ensureTrace(matchSel.value);
    await ensureTrace(partnerAutoFor(matchSel.value) ?? "");
    newSession();
  };
  // The Autos for Full Match, from public/drill/autos/index.json (scripts/drill-auto-traces.py).
  void loadAutoIndex()
    .then(async (autos) => {
      for (const a of autos) {
        const o = document.createElement("option");
        o.value = a.auto;
        o.textContent = `Full match: ${a.auto} (${a.autoTips} AUTO TIP${a.autoTips === 1 ? "" : "s"})`;
        matchSel.append(o);
      }
      const want = prefs.match;
      if (want && autos.some((a) => a.auto === want)) {
        matchSel.value = want;
        await ensureTrace(want);
        await ensureTrace(partnerAutoFor(want) ?? "");
        newSession();
      }
    })
    .catch(() => {
      /* no Autos published: the 2:00 drill only */
    });
  camSel.onchange = () => {
    view.mode = camSel.value as CameraMode;
    savePrefs();
  };
  lookSel.onchange = () => {
    view.look = lookSel.value === "cad" ? "cad" : "toy";
    savePrefs();
  };
  labelSel.onchange = () => {
    view.labels = labelSel.value === "on";
    savePrefs();
  };
  addEventListener("keydown", (e) => {
    if ((e.target as HTMLElement).closest("select, input")) return;
    if (e.key === "Enter") start();
    else if (e.key === "r" || e.key === "R") newSession();
    else if (e.key === "c" || e.key === "C") cycleCamera();
    else if (e.key === "f" || e.key === "F") toggleDrive();
    else if (e.key === "s" || e.key === "S") togglePanel();
  });
  $("drive-btn").onclick = () => setDrive(true);
  $("drive-exit").onclick = () => setDrive(false);
  $("panel-btn").onclick = () => togglePanel();
  requestAnimationFrame(frame);
}

void main();
