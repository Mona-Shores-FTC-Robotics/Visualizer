import type { Plugin, ViteDevServer } from "vite";
import type { IncomingMessage, ServerResponse } from "node:http";
import { spawn, type ChildProcess } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, join, resolve } from "node:path";
import {
  GENERATED_DIRS,
  PP_DIRS,
  generatedDirFor,
  ppPathProblem,
  simSpec,
  sourceOf,
} from "../src/lib/sim/biobuzz";

/**
 * The dev server's link to a biobuzz checkout, for the Simulator dialog:
 * list and open the .pp files there, and "Run in simulator" — save the .pp,
 * export its Java next to the other generated Autos, run SimRunTest with
 * Gradle, and hand back its result.json and .wpilogs.
 *
 * Only in `npm run dev` (the hosted site has no checkout to reach), only
 * from this computer, and only .pp files in biobuzz's two Auto folders and
 * the generated classes they make. The checkout is BIOBUZZ_DIR, or
 * ../biobuzz beside this one.
 */
export function biobuzzBridge(): Plugin {
  return {
    name: "biobuzz-bridge",
    apply: "serve",
    configureServer(server) {
      const dir = resolve(
        process.env.BIOBUZZ_DIR ?? resolve(server.config.root, "..", "biobuzz"),
      );
      const bridge = new Bridge(dir, server);
      server.middlewares.use("/__biobuzz", (req, res) => {
        bridge.handle(req, res).catch((error: unknown) => {
          send(res, 500, {
            error: error instanceof Error ? error.message : String(error),
          });
        });
      });
    },
  };
}

interface Job {
  id: string;
  folder: string;
  ppPath: string;
  javaFile: string;
  spec: string;
  startedAt: number;
  endedAt: number | null;
  exitCode: number | null;
  output: string[];
  process: ChildProcess | null;
}

const KEEP_LINES = 400;

class Bridge {
  private jobs = new Map<string, Job>();
  private running: Job | null = null;

  constructor(
    private dir: string,
    private server: ViteDevServer,
  ) {}

  async handle(req: IncomingMessage, res: ServerResponse) {
    if (!isLocal(req))
      return send(res, 403, {
        error: "The biobuzz bridge answers only this computer.",
      });
    const url = new URL(req.url ?? "/", "http://localhost");
    const route = `${req.method} ${url.pathname}`;
    if (route === "GET /status") return send(res, 200, this.status());
    if (!this.checkout())
      return send(res, 404, {
        error: `No biobuzz checkout at ${this.dir}. Set BIOBUZZ_DIR.`,
      });
    // A page from another site can send a simple request here, never one with this header.
    if (req.headers["x-biobuzz"] !== "1")
      return send(res, 403, { error: "Missing X-Biobuzz header." });
    if (route === "GET /files") return send(res, 200, { files: this.files() });
    if (route === "GET /file")
      return this.readPp(url.searchParams.get("path") ?? "", res);
    if (route === "POST /run")
      return this.startRun(JSON.parse(await body(req)), res);
    if (route === "GET /run")
      return this.runStatus(url.searchParams.get("id") ?? "", res);
    if (route === "GET /log")
      return this.sendLog(
        url.searchParams.get("id") ?? "",
        url.searchParams.get("file") ?? "",
        res,
      );
    send(res, 404, { error: `No such bridge call: ${route}` });
  }

  private checkout(): boolean {
    return (
      existsSync(join(this.dir, "gradlew")) &&
      existsSync(join(this.dir, "TeamCode"))
    );
  }

  private status() {
    if (!this.checkout())
      return {
        ok: false,
        dir: this.dir,
        reason: `No biobuzz checkout at ${this.dir}`,
      };
    let branch: string | null = null;
    try {
      const head = readFileSync(join(this.dir, ".git", "HEAD"), "utf8").trim();
      branch = head.startsWith("ref: refs/heads/")
        ? head.slice(16)
        : head.slice(0, 7);
    } catch {
      // A worktree or an unusual checkout: the branch is only shown, never needed.
    }
    return {
      ok: true,
      dir: this.dir,
      branch,
      running: this.running ? this.running.id : null,
      // SimRunTest is new; a branch without it cannot run anything.
      canRun: existsSync(
        join(
          this.dir,
          "TeamCode/src/test/java/org/firstinspires/ftc/teamcode/logging/SimRunTest.java",
        ),
      ),
    };
  }

  /** Every .pp in the Auto folders, with the generated class that names it as its SOURCE. */
  private files() {
    const classes = this.generatedBySource();
    const out: { path: string; autoClass: string | null }[] = [];
    for (const top of PP_DIRS) {
      for (const path of walk(join(this.dir, top), top)) {
        if (path.endsWith(".pp"))
          out.push({
            path,
            autoClass: classes.get(basename(path))?.className ?? null,
          });
      }
    }
    return out.sort((a, b) => a.path.localeCompare(b.path));
  }

  /** Generated classes by the .pp they name: SOURCE is a file name, so the first wins. */
  private generatedBySource() {
    const map = new Map<string, { className: string; file: string }>();
    for (const top of GENERATED_DIRS) {
      const abs = join(this.dir, top);
      if (!existsSync(abs)) continue;
      for (const name of readdirSync(abs)) {
        if (!name.endsWith(".java")) continue;
        const source = sourceOf(readFileSync(join(abs, name), "utf8"));
        if (source && !map.has(source))
          map.set(source, {
            className: name.slice(0, -5),
            file: `${top}/${name}`,
          });
      }
    }
    return map;
  }

  private readPp(path: string, res: ServerResponse) {
    const problem = ppPathProblem(path);
    if (problem) return send(res, 400, { error: problem });
    const abs = join(this.dir, path);
    if (!existsSync(abs))
      return send(res, 404, { error: `biobuzz has no ${path}` });
    send(res, 200, { path, text: readFileSync(abs, "utf8") });
  }

  private async startRun(request: RunRequest, res: ServerResponse) {
    if (this.running)
      return send(res, 409, { error: "A simulation is already running." });
    const problem = ppPathProblem(request.path ?? "");
    if (problem) return send(res, 400, { error: problem });
    if (typeof request.text !== "string")
      return send(res, 400, { error: "No project text." });

    // Export first, from the text as it will be saved: the same exporter as the CLI.
    const { generateAutoJavaFromText } = await this.server.ssrLoadModule(
      "/src/lib/codegen/auto/fromFile.ts",
    );
    const exported = generateAutoJavaFromText(
      request.text,
      basename(request.path),
    );
    if (!exported.ok)
      return send(res, 422, {
        error: "Export blocked",
        errors: exported.errors,
      });

    let partnerClass: string | null = null;
    if (request.partner) {
      partnerClass =
        this.generatedBySource().get(basename(request.partner))?.className ??
        null;
      if (!partnerClass)
        return send(res, 400, {
          error: `${request.partner} has no exported class in biobuzz yet.`,
        });
    }

    // The class that already names this .pp is overwritten where it is; a new one goes by folder.
    const existing = this.generatedBySource().get(basename(request.path));
    const javaFile =
      existing?.file ?? `${generatedDirFor(request.path)}/${exported.fileName}`;
    if (existing && basename(existing.file) !== exported.fileName) {
      return send(res, 409, {
        error: `${existing.file} already names ${basename(request.path)} as its SOURCE; rename one of them.`,
      });
    }
    mkdirSync(join(this.dir, request.path, ".."), { recursive: true });
    writeFileSync(join(this.dir, request.path), request.text);
    writeFileSync(join(this.dir, javaFile), exported.source);

    const autoClass = exported.fileName.replace(/\.java$/, "");
    const spec = simSpec(autoClass, partnerClass, finite(request.speed, 50));
    const id = `${new Date().toISOString().replace(/[:.]/g, "-")}-${autoClass}`;
    const folder = join(this.dir, "TeamCode", "build", "sim-runs", id);
    mkdirSync(folder, { recursive: true });
    writeFileSync(
      join(folder, "request.json"),
      JSON.stringify({
        spec,
        design: request.design ?? null,
        partnerDesign: request.partnerDesign ?? null,
        partnerSpeed: Number.isFinite(request.partnerSpeed)
          ? request.partnerSpeed
          : null,
        seeds: seedList(request.seeds),
        alliance: request.alliance === "BLUE" ? "BLUE" : "RED",
      }),
    );

    const job: Job = {
      id,
      folder,
      ppPath: request.path,
      javaFile,
      spec,
      startedAt: Date.now(),
      endedAt: null,
      exitCode: null,
      output: [],
      process: null,
    };
    this.jobs.set(id, job);
    this.running = job;
    this.gradle(job);
    send(res, 202, { id, spec, javaFile, warnings: exported.warnings });
  }

  private gradle(job: Job) {
    const windows = process.platform === "win32";
    const args = [
      ":TeamCode:testDebugUnitTest",
      "--tests",
      "org.firstinspires.ftc.teamcode.logging.SimRunTest",
      // The test reads its request from a file Gradle cannot see, so never let Gradle skip it.
      "--rerun",
      "-i",
    ];
    const child = spawn(windows ? "gradlew.bat" : "./gradlew", args, {
      cwd: this.dir,
      env: { ...process.env, BIOBUZZ_SIM_RUN: job.folder },
      shell: windows,
    });
    job.process = child;
    const take = (chunk: Buffer) => {
      for (const line of chunk.toString().split(/\r?\n/)) {
        if (!line.trim()) continue;
        job.output.push(line);
      }
      if (job.output.length > KEEP_LINES)
        job.output.splice(0, job.output.length - KEEP_LINES);
    };
    child.stdout?.on("data", take);
    child.stderr?.on("data", take);
    const finish = (code: number | null) => {
      if (job.endedAt !== null) return;
      job.endedAt = Date.now();
      job.exitCode = code ?? -1;
      job.process = null;
      if (this.running === job) this.running = null;
    };
    child.on("error", (error) => {
      job.output.push(`Could not start Gradle: ${error.message}`);
      finish(-1);
    });
    child.on("close", finish);
  }

  private runStatus(id: string, res: ServerResponse) {
    const job = this.jobs.get(id);
    if (!job)
      return send(res, 404, {
        error: `No run ${id} (the dev server restarted?)`,
      });
    const resultFile = join(job.folder, "result.json");
    // result.json is written once, at the end, so it is whole when it is there.
    const result =
      job.endedAt !== null && existsSync(resultFile)
        ? JSON.parse(readFileSync(resultFile, "utf8"))
        : null;
    send(res, 200, {
      id: job.id,
      spec: job.spec,
      ppPath: job.ppPath,
      javaFile: job.javaFile,
      folder: job.folder,
      state:
        job.endedAt === null
          ? "running"
          : job.exitCode === 0
            ? "done"
            : "failed",
      seconds: ((job.endedAt ?? Date.now()) - job.startedAt) / 1000,
      output: job.output.slice(-60),
      result,
    });
  }

  private sendLog(id: string, file: string, res: ServerResponse) {
    const job = this.jobs.get(id);
    if (!job || !/^seed-\d+\.wpilog$/.test(file))
      return send(res, 404, { error: "No such log" });
    const abs = join(job.folder, file);
    if (!existsSync(abs)) return send(res, 404, { error: "No such log" });
    const name = `${job.spec.split("@")[0].replace(/[^A-Za-z0-9]+/g, "-")}-${file}`;
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${name}"`);
    res.end(readFileSync(abs));
  }
}

interface RunRequest {
  path: string;
  text: string;
  partner?: string | null;
  design?: string | null;
  partnerDesign?: string | null;
  partnerSpeed?: number;
  speed?: number;
  seeds?: number;
  alliance?: string;
}

function seedList(count: unknown): number[] {
  const n = Math.min(50, Math.max(1, Math.round(finite(count, 10))));
  return Array.from({ length: n }, (_, i) => i + 1);
}

function finite(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : fallback;
}

function walk(abs: string, rel: string): string[] {
  if (!existsSync(abs)) return [];
  return readdirSync(abs).flatMap((name) => {
    const childAbs = join(abs, name);
    const childRel = `${rel}/${name}`;
    return statSync(childAbs).isDirectory()
      ? walk(childAbs, childRel)
      : [childRel];
  });
}

function isLocal(req: IncomingMessage): boolean {
  const address = req.socket.remoteAddress ?? "";
  return (
    address === "127.0.0.1" ||
    address === "::1" ||
    address === "::ffff:127.0.0.1"
  );
}

function body(req: IncomingMessage): Promise<string> {
  return new Promise((done, fail) => {
    let text = "";
    req.setEncoding("utf8");
    req.on("data", (chunk: string) => (text += chunk));
    req.on("end", () => done(text));
    req.on("error", fail);
  });
}

function send(res: ServerResponse, status: number, value: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(value));
}
