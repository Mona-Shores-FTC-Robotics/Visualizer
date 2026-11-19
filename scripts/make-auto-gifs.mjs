#!/usr/bin/env node
// Writes public/autos/<id>.gif, the animations on the Team Autos page (public/autos.html).
//
// Each GIF is the field from the Visualizer's own match view playing an Auto (or a pair) from
// biobuzz master, at the preview's default answers: every wait's trigger comes (DEFAULT_ANSWER in
// src/lib/auto/simulate.ts), so it is the drawn best case. A match clock is drawn on the field.
//
// Run with the dev server up:   pnpm dev --port 5179 &   node scripts/make-auto-gifs.mjs
// Needs Playwright (pre-installed or a dev dependency) and ffmpeg on the PATH.
// Options: --base http://localhost:5179/  --only lane,r-solo  --fps 10  --speed 3  --width 480
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

/** The Team Autos page's entries. Keep in step with ENTRIES in public/autos.html. */
export const GIFS = [
  { id: "lane", files: ["r-outside-lane.pp", "l-under-hive.pp"] },
  { id: "clockwise", files: ["r-clockwise.pp", "l-clockwise.pp"] },
  { id: "nocross", files: ["r-no-cross.pp", "l-no-cross.pp"] },
  { id: "r-solo", files: ["r-solo.pp"] },
  { id: "r-no-cross", files: ["r-no-cross.pp"] },
  { id: "l-no-cross", files: ["l-no-cross.pp"] },
  { id: "l-assist", files: ["drafts/l-assist.pp"] },
];

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const BASE = arg("base", "http://localhost:5179/");
const FPS = Number(arg("fps", "10"));
const SPEED = Number(arg("speed", "3"));
const WIDTH = Number(arg("width", "480"));
const ONLY = arg("only", "")?.split(",").filter(Boolean);
const AUTO_S = 30;
const OUT = new URL("../public/autos/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
for (const gif of GIFS.filter((g) => !ONLY?.length || ONLY.includes(g.id))) {
  const page = await browser.newPage({
    viewport: { width: 1400, height: 1000 },
    colorScheme: "dark",
  });
  await page.goto(`${BASE}#team=master/${gif.files.join(",")}`);
  const pair = gif.files.length > 1;
  // A pair opens in the match view, whose timeline is a slider over the 30 s; one Auto opens in
  // the editor, whose playback bar is a range input over the preview's own length.
  const timeline = page.locator(
    'svg[role="slider"][aria-label^="Match timeline"]',
  );
  const range = page.locator(
    'input[type="range"][aria-label="Playback position"]',
  );
  await (pair ? timeline : range).waitFor({ timeout: 30000 });
  await page.waitForTimeout(2000);
  if (!pair) {
    // Nothing selected, and no editor chrome over the field.
    await page.keyboard.press("Escape");
  }

  // The field: the drawing layer's square box.
  const field = page.locator("svg.absolute.inset-0.z-30").first();
  const box = await field.boundingBox();
  if (!box) throw new Error(`${gif.id}: no field`);
  // Hide the editor's tool rails and bars that float over the field's edges.
  await field.evaluate((el, b) => {
    const square = el.parentElement;
    const points = [];
    for (const fx of [0.02, 0.5, 0.98])
      for (const fy of [0.02, 0.5, 0.98]) points.push([fx, fy]);
    for (const [fx, fy] of points)
      for (const hit of document.elementsFromPoint(
        b.x + b.width * fx,
        b.y + b.height * fy,
      )) {
        if (square.contains(hit) || hit.contains(square)) break;
        hit.style.visibility = "hidden";
      }
  }, box);
  // The match clock, drawn over the field's bottom-left corner.
  await field.evaluate((el) => {
    const clock = document.createElement("div");
    clock.id = "gif-clock";
    Object.assign(clock.style, {
      position: "absolute",
      left: "8px",
      bottom: "8px",
      zIndex: "60",
      font: "600 22px ui-monospace, Menlo, monospace",
      color: "#fff",
      background: "rgba(0,0,0,.65)",
      padding: "2px 10px",
      borderRadius: "6px",
    });
    el.parentElement.appendChild(clock);
  });

  let seek;
  if (pair) {
    // The timeline maps x to seconds linearly: calibrate it from two clicks.
    const tb = await timeline.boundingBox();
    const y = tb.y + tb.height / 2;
    const readAt = async (x) => {
      await page.mouse.click(x, y);
      await page.waitForTimeout(200);
      return Number(await timeline.getAttribute("aria-valuenow"));
    };
    const xa = tb.x + tb.width * 0.3;
    const xb = tb.x + tb.width * 0.9;
    const ta = await readAt(xa);
    const tbv = await readAt(xb);
    const pxPerS = (xb - xa) / (tbv - ta);
    if (!(pxPerS > 0 && isFinite(pxPerS)))
      throw new Error(
        `${gif.id}: the timeline did not seek (${ta} s, ${tbv} s)`,
      );
    seek = (t) =>
      page.mouse.click(
        Math.min(xa + (t - ta) * pxPerS, tb.x + tb.width - 2),
        y,
      );
  } else {
    // The readout says "<now> / <end> s of 30 s": the preview's length.
    const readout = await range
      .locator("xpath=../following-sibling::div")
      .innerText();
    const end = Number(readout.match(/\/\s*([\d.]+)\s*s/)?.[1]);
    if (!(end > 0))
      throw new Error(`${gif.id}: no preview length in "${readout}"`);
    seek = (t) =>
      range.evaluate(
        (el, pct) => {
          el.value = String(pct);
          el.dispatchEvent(new Event("input", { bubbles: true }));
        },
        Math.min(100, (t / end) * 100),
      );
  }

  const dir = mkdtempSync(join(tmpdir(), `gif-${gif.id}-`));
  const frames = Math.round((AUTO_S * FPS) / SPEED);
  for (let i = 0; i <= frames; i++) {
    const t = (i / frames) * AUTO_S;
    await seek(t);
    await page.evaluate((s) => {
      document.getElementById("gif-clock").textContent = `${s.toFixed(1)} s`;
    }, t);
    await page.screenshot({
      path: join(dir, `f${String(i).padStart(4, "0")}.png`),
      clip: box,
    });
  }
  // Hold the last frame a second before the loop starts again.
  const target = join(OUT, `${gif.id}.gif`);
  execFileSync("ffmpeg", [
    "-y",
    "-loglevel",
    "error",
    "-framerate",
    String(FPS),
    "-i",
    join(dir, "f%04d.png"),
    "-vf",
    `tpad=stop_mode=clone:stop_duration=1.2,scale=${WIDTH}:-1:flags=lanczos,split[a][b];` +
      "[a]palettegen=max_colors=96:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle",
    "-loop",
    "0",
    target,
  ]);
  rmSync(dir, { recursive: true, force: true });
  console.log(`${gif.id}: ${(statSync(target).size / 1024).toFixed(0)} KB`);
  await page.close();
}
await browser.close();
