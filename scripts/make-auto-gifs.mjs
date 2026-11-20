#!/usr/bin/env node
// Writes the Auto Strategy page's animations (public/autos.html):
// public/autos/<id>--<key>--<show>--<red|blue>.gif and .mp4, one per scenario that drives differently, per
// view (both robots, or one with the other not drawn), per alliance; and
// public/autos/manifest.json, which the page reads.
//
// The frame is the whole field, wall to wall: the field image's own bounds plus a few pixels, with
// the field square's clipping lifted and everything else on the page hidden. Blue is red turned
// half a turn about the field's centre (the field is rotationally symmetric, not a mirror), so its
// frames are the red ones rotated 180°; the clock is drawn after, by ffmpeg, so it stays upright.
//
// Each Auto (or pair) is opened from biobuzz master in the Visualizer's dev server, and its
// switches are derived from the Autos themselves, not picked by hand:
//   - an INIT route choice (a wait drawn as `choice`, e.g. Pickup, Priority, "if no TIP 1") is a
//     switch between its two legs;
//   - a TIP the Auto waits for is a switch: the volley at it lands, or misses. One Auto alone:
//     every wait the drawing branches on, numbered by the TIP that answers it in the preview (the
//     TIPs settled by the time it is answered), and "misses" answers every wait on that TIP no, so
//     the drawn fallback (a fix) runs. A pair: the Match view's TIP rows (lib/match/tipToggles.ts),
//     and "misses" is its first try missing: a later volley at it (a fix) can still TIP it.
// Choices come first, each followed by the TIP it names, then the other TIPs; at most MAX_SWITCHES.
// Every combination is previewed; combinations that drive the same way share one GIF.
//
// Run with the dev server up:   pnpm dev --port 5179 &   node scripts/make-auto-gifs.mjs
// It reads the app through window.__visualizer, which App.svelte sets on the dev server only.
// Needs Playwright and ffmpeg. Options: --base URL  --only lane,r-solo  --fps 30  --speed 3  --width 480
// --keep-gifs (rewrite the manifest; capture only the GIFs that are missing)
// --only clockwise: redo just that card (or a comma list of card ids); the manifest keeps the rest
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

/** The Team Autos page's cards. The page takes its names and order from the manifest. */
export const CARDS = [
  {
    id: "lane",
    group: "pair",
    name: "R-LeftUnderHive + L-LeftUnderHive",
    files: ["r-left-under-hive.pp", "l-left-under-hive.pp"],
    halves: ["R-LeftUnderHive", "L-LeftUnderHive"],
  },
  {
    id: "clockwise",
    group: "pair",
    name: "R-Clockwise + L-Clockwise",
    files: ["r-clockwise.pp", "l-clockwise.pp"],
    halves: ["R-Clockwise", "L-Clockwise"],
  },
  {
    id: "nocross",
    group: "pair",
    name: "R-NoCross + L-NoCross",
    files: ["r-no-cross.pp", "l-no-cross.pp"],
    halves: ["R-NoCross", "L-NoCross"],
  },
  {
    id: "r-solo",
    group: "solo",
    name: "R-Solo",
    files: ["r-solo.pp"],
    tag: "Default",
  },
];
const MAX_SWITCHES = 4;
/** The clock's centre on a blue frame, as fractions of the frame (red: 1 − each): the far CELLs. */
const CLOCK_X = 0.385;
const CLOCK_Y = 0.48;
const AUTO_S = 30;

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const BASE = arg("base", "http://localhost:5179/");
// 30 frames a second at 3×: one frame per 0.1 s of match, so the page's real-time speed (a third)
// still plays 10 frames a second. The GIF fallback keeps 10 frames a second.
const FPS = Number(arg("fps", "30"));
const GIF_FPS = Math.min(FPS, 10);
const SPEED = Number(arg("speed", "3"));
const WIDTH = Number(arg("width", "720"));
// --keep-gifs: rewrite the manifest, and capture only GIFs that are not there yet.
const KEEP_GIFS = process.argv.includes("--keep-gifs");
const ONLY = arg("only", "")?.split(",").filter(Boolean);
const OUT = new URL("../public/autos/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
// Each animation is also an H.264 MP4 beside its GIF (same frames and clock): the page plays the
// MP4, which pauses, seeks and slows, and falls back to the GIF. --mp4 DIR writes them elsewhere.
const MP4_DIR = arg("mp4", OUT);
mkdirSync(MP4_DIR, { recursive: true });

/** "CROSS AND FIX IT" → "Cross & fix"; "WALL_FLOWER" → "Wall flower". */
const pretty = (s) => {
  const t = String(s)
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\band\b/g, "&")
    .replace(/\s+it$/, "")
    .trim();
  return t.replace(/\btip\b/g, "TIP").replace(/^./, (c) => c.toUpperCase());
};

// ---- In the page -------------------------------------------------------------------------------

/** Runs in the page: the Auto's route choices, from the drawing. */
function pageChoices() {
  const v = window.__visualizer;
  const autos = v.overlays.active
    ? v.overlays.items.map((o) => o.doc.auto)
    : [v.auto.auto];
  // A choice two Autos both have (Clockwise's Pickup) is one option, set on both: each owner keeps
  // its own legs, in its own order (R's first leg is the WALL FLOWER, L's the GARDEN).
  const out = [];
  const walk = (cards, robot) => {
    for (const c of cards ?? []) {
      if (c.kind !== "firstOf") continue;
      if (c.choice) {
        const yes = c.rows.findIndex((r) => "when" in r);
        const legs = [
          c.rows[yes].label ?? "yes",
          c.rows[1 - yes].label ?? "no",
        ];
        let choice = out.find((o) => o.option === c.choice);
        if (!choice) {
          choice = {
            option: c.choice,
            condition: c.rows[yes].when[0],
            legs,
            owners: [],
          };
          out.push(choice);
        }
        if (!choice.owners.some((o) => o.robot === robot))
          choice.owners.push({ robot, legs });
      }
      for (const r of c.rows) walk(r.cards, robot);
    }
  };
  autos.forEach((a, robot) => walk(a?.cards, robot));
  return out;
}

/**
 * Runs in the page: sets one look and reports it. `look` is { choices: {condition: bool},
 * tips: {n: bool}, waitTips: {cardId: n} } (alone: which TIP each branching wait is for).
 */
async function pageLook(look) {
  const v = window.__visualizer;
  const a = v.auto;
  if (v.overlays.active) {
    a.match.reset();
    for (const [n, comes] of Object.entries(look.tips))
      if (!comes) a.match.setTipMisses(Number(n), 1);
    for (const o of v.overlays.items) {
      for (const [condition, yes] of Object.entries(look.choices))
        if (!yes) a.match.setTrigger(o.filePath, o.doc.auto, condition, false);
    }
  } else {
    const store = await import("/src/lib/auto/store.ts");
    const scenario = {};
    for (const [condition, yes] of Object.entries(look.choices))
      if (!yes) scenario[condition] = false;
    for (const [id, n] of Object.entries(look.waitTips))
      if (look.tips[n] === false) scenario[`wait:${id}`] = false;
    store.previewScenario.set(scenario);
    // The TIP misses on the HIVE too (its volley's pieces do not land), as in a pair.
    a.match.reset();
    for (const [n, comes] of Object.entries(look.tips))
      if (!comes) a.match.setTipMisses(Number(n), 1);
  }
  await new Promise((r) =>
    requestAnimationFrame(() => requestAnimationFrame(r)),
  );
  const together = v.overlays.active ? a.overlayTogether : a.together;
  const raw = together.previews ?? [];
  const previews = (raw instanceof Map ? [...raw.values()] : [...raw]).filter(
    Boolean,
  );
  // The TIPs that count as AUTO (the team's rule): the last ball out by 30 s, settled by 38 s.
  const tips = together.tips.filter(
    (t) => (t.lastBall ?? t.start) <= 30 + 1e-6 && t.settled <= 38 + 1e-6,
  );
  // Which TIP each branching wait reached is for, by the CELL it asks about: RIGHT is up at the
  // start and after TIPs 2, 4…; LEFT after TIPs 1, 3…. CellUp is the CELL at the robot's end (the
  // end of its last drive: y above the centre is LEFT). With k TIPs settled when it is asked, it
  // checks TIP k if that CELL is up, else waits for TIP k + 1. (Alone, the preview answers a wait
  // for the partner's TIP at once, so its time cannot tell.)
  const lines = v.overlays.active ? null : v.project.doc.lines;
  const waits = {};
  previews.forEach((p, pi) => {
    const docLines = lines ?? v.overlays.items[pi]?.doc.lines ?? [];
    for (const e of p.log ?? []) {
      const m =
        e.kind === "row" && e.cardId && e.text.match(/ \((\w+) true\)$/);
      if (!m) continue;
      let left;
      if (/^Left/.test(m[1])) left = true;
      else if (/^Right/.test(m[1])) left = false;
      else {
        const last = (p.drives ?? []).filter((d) => d.t1 <= e.t + 1e-6).pop();
        const end = docLines.find((l) => l.id === last?.pathId)?.endPoint;
        if (!end) continue;
        left = end.y > 70.75;
      }
      const k = tips.filter((t) => t.settled <= e.t + 1e-6).length;
      const upNow = (k % 2 === 1) === left;
      waits[e.cardId] = upNow && k > 0 ? k : k + 1;
    }
  });
  const branching = new Set();
  const walk = (cards) => {
    for (const c of cards ?? []) {
      if (c.kind !== "firstOf") continue;
      const plain = c.rows.every((r) => !r.cards?.length);
      if (!c.choice && !plain && c.rows.some((r) => "when" in r))
        branching.add(c.id);
      for (const r of c.rows) walk(r.cards);
    }
  };
  (v.overlays.active
    ? v.overlays.items.map((o) => o.doc.auto)
    : [a.auto]
  ).forEach((x) => walk(x?.cards));
  for (const id of Object.keys(waits)) if (!branching.has(id)) delete waits[id];
  // Waits that ask about a CELL: only their "otherwise" words describe a fallback (a hold or a
  // route choice's leg has words of its own that do not read as one).
  const cellWaits = new Set();
  const walkCells = (cards) => {
    for (const c of cards ?? []) {
      if (c.kind !== "firstOf") continue;
      if (!c.choice && c.rows.some((r) => r.when?.some((w) => /Cell/.test(w))))
        cellWaits.add(c.id);
      for (const r of c.rows) walkCells(r.cards);
    }
  };
  (v.overlays.active
    ? v.overlays.items.map((o) => o.doc.auto)
    : [a.auto]
  ).forEach((x) => walkCells(x?.cards));
  // What the robots did differently: each wait that timed out says what it does then, in the
  // drawing's own words ("LEFT up before 9 s, otherwise cross under the HIVE, …").
  const names = v.overlays.active
    ? v.overlays.items.map((o) =>
        /(^|\/)(biobuzz-)?((drafts|partners)[-/])?r-/.test(o.filePath)
          ? "R"
          : /(^|\/)(biobuzz-)?((drafts|partners)[-/])?l-/.test(o.filePath)
            ? "L"
            : "",
      )
    : [""];
  const did = [];
  previews.forEach((p, pi) => {
    for (const e of p.log ?? []) {
      if (e.kind !== "row" || / true\)$/.test(e.text)) continue;
      if (!cellWaits.has(e.cardId)) continue;
      const m = e.text.match(/otherwise (.+?) → /);
      if (m)
        did.push(
          `${names[pi] ? names[pi] + " " : ""}${m[1]}`.replace(/^./, (c) =>
            c.toUpperCase(),
          ),
        );
    }
  });
  // Each robot's drives (in the overlays' order): a view with one robot drawn changes only when
  // that robot's do.
  // Every view draws the HIVE too: its TIPs and each volley that lands or misses, so two looks
  // share a GIF only when the drawn robots drive the same and the HIVE does the same.
  const hive = a.hive?.history;
  const hiveSignature = JSON.stringify([
    (hive?.tips ?? []).map((t) => t.start.toFixed(1)),
    (hive?.volleys ?? []).map(
      (x) => `${x.t.toFixed(1)}${x.counted ? "" : "x"}`,
    ),
  ]);
  const robotSignatures = previews.map((p) =>
    JSON.stringify([
      (p.drives ?? []).map((d) => `${d.pathId}@${d.t0.toFixed(1)}`),
      hiveSignature,
    ]),
  );
  const signature = JSON.stringify(robotSignatures);
  let result;
  if (v.overlays.active) {
    result = a.matchResultLine;
    v.overlays.items.forEach((o) => {
      // As the result line names it ("drafts-r-right-under-hive"), and its side from the Auto's own name.
      const raw = o.filePath
        .replace(/^.*\//, "")
        .replace(/^biobuzz-/, "")
        .replace(/\.pp$/, "");
      const name = raw.replace(/^(drafts|partners)-/, "");
      result = result
        .split(raw)
        .join(name.startsWith("r-") ? "R" : name.startsWith("l-") ? "L" : raw);
    });
  } else {
    const p = previews[0];
    const end = p.stalled
      ? "stuck in a wait"
      : p.unparked
        ? "not parked"
        : p.endTime > 30
          ? `over 30 s by ${(p.endTime - 30).toFixed(1)} s`
          : p.guard
            ? `parked by the guard at ${p.guard.t.toFixed(1)} s`
            : `parked at ${p.endTime.toFixed(1)} s`;
    result = `${tips.length} TIP${tips.length === 1 ? "" : "s"} by this robot · ${end}`;
  }
  // Pair: the Match view's TIP rows.
  const tipRows = [...document.querySelectorAll("span")]
    .filter((s) => /^TIP \d+ comes on$/.test(s.textContent.trim()))
    .map((s) => Number(s.textContent.match(/\d+/)[0]));
  const contact = v.overlays.active ? (a.matchContactAt ?? null) : null;
  // The result as data, for the page to lay out: each TIP that counts (when it settles; after 30 s
  // still counts, by the team's rule), and each robot's end, by overlay index.
  const ends = v.overlays.active
    ? (a.matchLanes?.robots ?? []).map((r) => ({
        still: r.still,
        stalled: r.stalled,
        unparked: r.unparked,
        end: r.endTime,
        guard: r.guard !== null,
      }))
    : [
        {
          still: false,
          stalled: Boolean(previews[0].stalled),
          unparked: Boolean(previews[0].unparked),
          end: previews[0].endTime,
          guard: Boolean(previews[0].guard),
        },
      ];
  const round = (x) => Math.round(x * 10) / 10;
  const outcome = {
    tips: tips.map((t) => ({ settled: round(t.settled) })),
    robots: ends.map((r) => {
      const why = r.still
        ? "no-show"
        : r.stalled
          ? "stuck in a wait"
          : r.unparked
            ? "not parked"
            : r.end > 30 + 1e-6
              ? "over 30 s"
              : null;
      return why
        ? { parked: null, why }
        : { parked: round(r.end), parkedBy: r.guard ? "guard" : null };
    }),
  };
  return {
    signature,
    robotSignatures,
    outcome,
    result,
    did,
    contact,
    waits,
    tipRows: [...new Set(tipRows)],
  };
}

// ---- Scenarios ---------------------------------------------------------------------------------

/** The card's switches and every combination's look, previewed. */
async function scenarios(page, card, letters) {
  const choices = await page.evaluate(pageChoices);
  const pair = card.files.length > 1;
  const base = { choices: {}, tips: {}, waitTips: {} };
  const first = await page.evaluate(pageLook, base);
  // TIPs: a pair's Match rows; alone, the TIPs its branching waits are for, found by previewing
  // until no new wait turns up (a wait inside a fallback is reached only when a TIP does not come).
  const waitTips = { ...first.waits };
  let tipNumbers = pair ? first.tipRows : [...new Set(Object.values(waitTips))];
  if (!pair) {
    for (let round = 0; round < 4; round++) {
      let grew = false;
      for (const n of [...tipNumbers].sort()) {
        const seen = await page.evaluate(pageLook, {
          choices: {},
          tips: { [n]: false },
          waitTips,
        });
        for (const [id, m] of Object.entries(seen.waits))
          if (!(id in waitTips)) {
            waitTips[id] = m;
            grew = true;
          }
      }
      tipNumbers = [...new Set(Object.values(waitTips))];
      if (!grew) break;
    }
  }
  tipNumbers.sort((x, y) => x - y);
  // Order: each choice, then the TIP it names; then the other TIPs.
  const switches = [];
  const used = new Set();
  for (const c of choices) {
    switches.push({
      kind: "choice",
      label: pretty(c.option),
      condition: c.condition,
      options: c.legs.map(pretty),
      owners: c.owners.map((o) => ({
        robot: o.robot,
        options: o.legs.map(pretty),
      })),
    });
    const n = Number(c.option.match(/TIP (\d+)/i)?.[1]);
    if (tipNumbers.includes(n) && !used.has(n)) {
      used.add(n);
      switches.push({
        kind: "tip",
        label: `TIP ${n}`,
        tip: n,
        options: ["Lands", "Misses"],
      });
    }
  }
  for (const n of tipNumbers)
    if (!used.has(n))
      switches.push({
        kind: "tip",
        label: `TIP ${n}`,
        tip: n,
        options: ["Lands", "Misses"],
      });
  const shown = switches.slice(0, MAX_SWITCHES);

  const looks = [];
  for (let bits = 0; bits < 1 << shown.length; bits++) {
    const key =
      shown.map((_, i) => ((bits >> i) & 1 ? "1" : "0")).join("") || "0";
    // A TIP that misses answers no only the waits the best case reaches for it (alone, the preview
    // takes a wait's TIP to come, the partner's included). A check inside the fallback reads the
    // HIVE as the miss left it: R-Solo's fix at RIGHT sees RIGHT still up and fires.
    const look = { choices: {}, tips: {}, waitTips: first.waits };
    shown.forEach((s, i) => {
      const flip = Boolean((bits >> i) & 1);
      if (s.kind === "choice") look.choices[s.condition] = !flip;
      else look.tips[s.tip] = !flip;
    });
    const seen = await page.evaluate(pageLook, look);
    // A choice made says itself ("Pickup: Garden"); a TIP that misses says what the drawing does.
    const picked = shown
      .map((sw, i) =>
        sw.kind === "choice" && (bits >> i) & 1
          ? sw.owners
              .map((o) =>
                `${letters[o.robot] ?? ""} ${sw.label}: ${o.options[1]}`.trim(),
              )
              .join(", ")
          : null,
      )
      .filter(Boolean);
    const did = [...picked, ...new Set(seen.did)].join("; ");
    looks.push({
      key,
      bits,
      look,
      contact: seen.contact,
      outcome: seen.outcome,
      // What the drawing does instead, in its own words, only where it says more than the switches.
      note: [...new Set(seen.did)].join("; ") || null,
      signature: seen.signature,
      robotSignatures: seen.robotSignatures,
      caption:
        bits === 0
          ? `Best case · ${seen.result}`
          : did
            ? `${did}. ${seen.result}`
            : seen.result,
    });
  }
  // Which choice option touches the partner: for each look, an option of a choice switch whose
  // look (this one, with that switch set to it) has contact while the other option's has none.
  // Read from the previews.
  const byKey = new Map(looks.map((l) => [l.key, l]));
  for (const l of looks) {
    l.warn = [];
    shown.forEach((sw, i) => {
      if (sw.kind !== "choice") return;
      const touches = [0, 1].map((j) => {
        const k = l.key.split("");
        k[i] = String(j);
        return byKey.get(k.join(""))?.contact != null;
      });
      // Only when the other option avoids it: then this pick is the one that touches.
      for (const j of [0, 1])
        if (touches[j] && !touches[1 - j]) l.warn.push(`${i}:${j}`);
    });
  }
  return {
    // A choice says whose Auto it is in (r or l, by the overlay's file), with that Auto's legs.
    switches: shown.map(({ kind, label, options, owners }) => ({
      kind,
      label,
      options,
      ...(owners
        ? {
            owners: owners.map((o) => ({
              robot: (letters[o.robot] || "r").toLowerCase(),
              options: o.options,
            })),
          }
        : {}),
    })),
    looks,
  };
}

// ---- Capture -----------------------------------------------------------------------------------

/**
 * The ffmpeg filter that draws the clock on frame n (n × STEP tenths of a second), centred over
 * the HIVE's other alliance's CELLs, which our robots never use: right of centre on a red frame,
 * and left of it on a blue one (the red frame turned half a turn, clock drawn after).
 */
function clockFilter(step, size, alliance) {
  const font = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf";
  const fontfile = existsSync(font) ? `fontfile=${font}:` : "";
  const tenths = `n*${step}`;
  return (
    `drawtext=${fontfile}text='%{eif\\:floor(${tenths}/10)\\:d}.%{eif\\:mod(${tenths}\\,10)\\:d}s':` +
    `fontsize=${Math.round(size * 0.06)}:fontcolor=white:box=1:boxcolor=black@0.65:boxborderw=8:` +
    `x=w*${alliance === "blue" ? CLOCK_X : 1 - CLOCK_X}-tw/2:y=h*${alliance === "blue" ? CLOCK_Y : 1 - CLOCK_Y}-th/2`
  );
}

/** Captures one look (`hide`: the overlay index not drawn, or null), red and blue. */
async function capture(page, card, look, hide, targets) {
  await page.evaluate(pageLook, look);
  await page.evaluate((h) => {
    window.__visualizer.overlays.drawHidden = h;
  }, hide);
  const box = await page.evaluate(() => window.__gifBox);
  const dir = mkdtempSync(join(tmpdir(), `gif-${card.id}-`));
  // The 30 s Auto, and on until the last TIP that counts has settled (the preview's clock runs
  // that long), a whole number of frames.
  const step = (10 * SPEED) / FPS;
  if (!Number.isInteger(step))
    throw new Error(`the clock needs whole tenths per frame (${step})`);
  const length = await page.evaluate(
    (s) => Math.max(s, window.__visualizer.playback.duration),
    AUTO_S,
  );
  const frames = Math.ceil((length * 10) / step - 1e-6);
  for (let i = 0; i <= frames; i++) {
    const t = (i * step) / 10;
    await page.evaluate(async (s) => {
      const p = window.__visualizer.playback;
      if (p.playing) p.toggle();
      p.seek(p.duration > 0 ? Math.min(100, (s / p.duration) * 100) : 0);
      await new Promise((r) =>
        requestAnimationFrame(() => requestAnimationFrame(r)),
      );
    }, t);
    await page.screenshot({
      path: join(dir, `f${String(i).padStart(4, "0")}.png`),
      clip: box,
    });
  }
  for (const [alliance, target] of Object.entries(targets)) {
    // Blue: the frame turned half a turn, then the clock. Hold the last frame before the loop.
    const turn = alliance === "blue" ? "hflip,vflip," : "";
    execFileSync("ffmpeg", [
      "-y",
      "-loglevel",
      "error",
      "-framerate",
      String(FPS),
      "-i",
      join(dir, "f%04d.png"),
      "-vf",
      `${turn}${clockFilter(step, box.width, alliance)},fps=${GIF_FPS},tpad=stop_mode=clone:stop_duration=1.2,` +
        `scale=${WIDTH}:-1:flags=lanczos,split[a][b];` +
        "[a]palettegen=max_colors=64:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle",
      "-loop",
      "0",
      target,
    ]);
    if (MP4_DIR) {
      execFileSync("ffmpeg", [
        "-y",
        "-loglevel",
        "error",
        "-framerate",
        String(FPS),
        "-i",
        join(dir, "f%04d.png"),
        "-vf",
        `${turn}${clockFilter(step, box.width, alliance)},tpad=stop_mode=clone:stop_duration=1.2,` +
          `scale=${WIDTH}:-2:flags=lanczos,format=yuv420p`,
        "-c:v",
        "libx264",
        "-preset",
        "slow",
        "-crf",
        "26",
        "-movflags",
        "+faststart",
        "-an",
        join(MP4_DIR, target.replace(/^.*\//, "").replace(/\.gif$/, ".mp4")),
      ]);
    }
  }
  rmSync(dir, { recursive: true, force: true });
}

async function open(browser, card) {
  const page = await browser.newPage({
    viewport: { width: 1400, height: 1000 },
    colorScheme: "dark",
  });
  page.on("pageerror", (e) => console.error(`${card.id}: ${e.message}`));
  await page.goto(`${BASE}#team=master/${card.files.join(",")}`);
  await page.waitForFunction(
    (pair) => {
      const v = window.__visualizer;
      return (
        v &&
        (pair ? v.overlays.active && v.auto.matchResultLine : v.auto.together)
      );
    },
    card.files.length > 1,
    { timeout: 30000 },
  );
  await page.waitForTimeout(1500);
  await page.keyboard.press("Escape");
  // The whole field: the field image's bounds, a few pixels out, with the square's clipping
  // lifted and everything that is not the field (rails, bars, axis labels) hidden.
  await page.evaluate(() => {
    const square = document.querySelector(
      "svg.absolute.inset-0.z-30",
    ).parentElement;
    square.style.overflow = "visible";
    for (const el of document.body.querySelectorAll("*"))
      if (!el.contains(square) && !square.contains(el))
        el.style.visibility = "hidden";
    const field = [...square.children].find(
      (c) =>
        c.tagName === "IMG" && /fields\//.test(c.getAttribute("src") ?? ""),
    );
    const b = field.getBoundingClientRect();
    const m = 4;
    window.__gifBox = {
      x: Math.floor(b.x - m),
      y: Math.floor(b.y - m),
      width: Math.ceil(b.width + 2 * m),
      height: Math.ceil(b.height + 2 * m),
    };
  });
  return page;
}

/** Which overlay draws each of the card's files (index in overlays.items). */
async function overlayIndexes(page, card) {
  return page.evaluate(
    (files) =>
      files.map((f) =>
        window.__visualizer.overlays.items.findIndex((o) =>
          o.filePath.endsWith(f.replace(/^.*\//, "")),
        ),
      ),
    card.files,
  );
}

const browser = await chromium.launch();
const manifest = {
  generated: new Date().toISOString().slice(0, 10),
  branch: "master",
  cards: [],
};
for (const card of CARDS.filter((c) => !ONLY?.length || ONLY.includes(c.id))) {
  const page = await open(browser, card);
  const pair = card.files.length > 1;
  const index = pair ? await overlayIndexes(page, card) : [0];
  if (pair && index.some((i) => i < 0))
    throw new Error(`${card.id}: an overlay is missing (${index})`);
  // Overlay index → "R" / "L" (the card's files are R's, then L's), and each robot's path colour.
  const letters = pair ? { [index[0]]: "R", [index[1]]: "L" } : { 0: "" };
  const colors = pair
    ? await page.evaluate(
        (ix) => ({
          r: window.__visualizer.overlays.items[ix[0]].color,
          l: window.__visualizer.overlays.items[ix[1]].color,
        }),
        index,
      )
    : null;
  const { switches, looks } = await scenarios(page, card, letters);
  if (process.env.DRY) console.log(card.id, JSON.stringify(switches));
  // Views: both robots; for a pair, also R alone and L alone (the other not drawn). A view shares a
  // GIF with every look whose drawn robots drive the same.
  const views = pair
    ? [
        { show: "both", hide: null, sig: (l) => l.signature },
        { show: "r", hide: index[1], sig: (l) => l.robotSignatures[index[0]] },
        { show: "l", hide: index[0], sig: (l) => l.robotSignatures[index[1]] },
      ]
    : [{ show: "both", hide: null, sig: (l) => l.signature }];
  const scenarios_ = {};
  for (const l of looks)
    scenarios_[l.key] = {
      gif: {},
      // The sentence, for the GIF's alt text; the page lays out the fields below.
      caption: l.caption,
      best: l.bits === 0,
      tips: l.outcome.tips,
      // R first, then L (a solo card's one robot is r).
      robots: l.outcome.robots
        .map((r, i) => ({ robot: (letters[i] || "r").toLowerCase(), ...r }))
        .sort((a, b) => a.robot.localeCompare(b.robot) * -1),
      contact: l.contact,
      ...(l.note ? { note: l.note } : {}),
      ...(l.warn.length ? { warn: l.warn } : {}),
    };
  for (const view of views) {
    const seen = new Map();
    for (const l of looks) {
      let base = seen.get(view.sig(l));
      if (!base) {
        base = `${card.id}--${l.key}--${view.show}`;
        seen.set(view.sig(l), base);
        const targets = {
          red: join(OUT, `${base}--red.gif`),
          blue: join(OUT, `${base}--blue.gif`),
        };
        const keep =
          KEEP_GIFS && Object.values(targets).every((t) => existsSync(t));
        if (!process.env.DRY && !keep)
          await capture(page, card, l.look, view.hide, targets);
        if (!process.env.DRY)
          console.log(
            `${base}: ${(statSync(targets.red).size / 1024).toFixed(0)} + ${(statSync(targets.blue).size / 1024).toFixed(0)} KB · ${l.caption}`,
          );
      }
      scenarios_[l.key].gif[view.show] = base;
    }
  }
  const { files, ...rest } = card;
  manifest.cards.push({
    ...rest,
    files,
    ...(colors ? { colors } : {}),
    switches,
    scenarios: scenarios_,
  });
  await page.close();
}
await browser.close();

// --only: the cards it ran replace theirs in the manifest already written, and every other card
// stays as it was (animations and results), so one changed Auto is a short run.
if (ONLY?.length) {
  const fresh = new Map(manifest.cards.map((c) => [c.id, c]));
  const path = join(OUT, "manifest.json");
  const before = existsSync(path)
    ? JSON.parse(readFileSync(path, "utf8"))
    : { cards: [] };
  const old = new Map(before.cards.map((c) => [c.id, c]));
  manifest.cards = CARDS.map((c) => fresh.get(c.id) ?? old.get(c.id)).filter(
    Boolean,
  );
}
{
  // Drop GIFs and MP4s no scenario names any more (with --only, only those of the cards it ran).
  if (process.env.DRY) process.exit(0);
  const keep = new Set(
    manifest.cards.flatMap((c) =>
      Object.values(c.scenarios).flatMap((s) =>
        Object.values(s.gif).flatMap((b) => [
          `${b}--red.gif`,
          `${b}--blue.gif`,
          `${b}--red.mp4`,
          `${b}--blue.mp4`,
        ]),
      ),
    ),
  );
  const ran = (f) =>
    !ONLY?.length || ONLY.some((id) => f.startsWith(`${id}--`));
  for (const f of readdirSync(OUT))
    if (/\.(gif|mp4)$/.test(f) && !keep.has(f) && ran(f))
      unlinkSync(join(OUT, f));
  if (process.env.DRY) process.exit(0);
  writeFileSync(
    join(OUT, "manifest.json"),
    JSON.stringify(manifest, null, 2).replace(
      /[\u0080-\uffff]/g,
      (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`,
    ) + "\n",
  );
  const total = [...keep].reduce((s, f) => s + statSync(join(OUT, f)).size, 0);
  console.log(`${keep.size} GIFs and MP4s, ${(total / 1e6).toFixed(1)} MB`);
}
