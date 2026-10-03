<script lang="ts">
  import Modal from "../components/ui/Modal.svelte";
  import { showToast } from "../toast";
  import {
    DEFAULT_DESIGN,
    baseName,
    robotProblems,
    runProblems,
    suggestPpPath,
    tally,
    type SimRun,
  } from "./biobuzz";
  import {
    BridgeError,
    bridgeStatus,
    downloadLog,
    listFiles,
    readFile,
    runStatus,
    startRun,
    type BridgeFile,
    type BridgeStatus,
    type RunStatus,
  } from "./bridgeClient";

  interface Props {
    isOpen?: boolean;
    /** The file open in the editor, e.g. "recycle5-left.pp" (empty if none). */
    fileName: string;
    /** The biobuzz .pp the open file was opened from, if it was. */
    openedFrom: string | null;
    /** The open project as it would be saved. */
    projectText: () => string;
    /** Puts a .pp read from biobuzz in the editor. */
    onOpen: (text: string, path: string) => void;
  }

  let {
    isOpen = $bindable(false),
    fileName,
    openedFrom,
    projectText,
    onOpen,
  }: Props = $props();

  const OPTIONS_KEY = "biobuzzSimOptions";
  const DESIGNS_KEY = "biobuzzSimDesigns";

  let status = $state<BridgeStatus | null>(null);
  let files = $state<BridgeFile[]>([]);
  let openPath = $state("");
  let target = $state("");
  let partner = $state("");
  let design = $state(DEFAULT_DESIGN);
  let partnerDesign = $state("");
  let speed = $state(50);
  let partnerSpeed = $state(40);
  let partnerSameSpeed = $state(true);
  let seeds = $state(10);
  let alliance = $state<"RED" | "BLUE">("RED");
  let designs = $state<string[]>(loadJson(DESIGNS_KEY, [DEFAULT_DESIGN]));

  let run = $state<RunStatus | null>(null);
  let starting = $state(false);
  let blocked = $state<string[]>([]);
  let expanded = $state<number | null>(null);
  let timer: ReturnType<typeof setTimeout> | null = null;

  let running = $derived(starting || run?.state === "running");
  let runs = $derived<SimRun[]>(run?.result?.runs ?? []);
  let summary = $derived(tally(runs));
  let partners = $derived(
    files.filter((f) => f.autoClass && f.path !== target),
  );

  $effect(() => {
    if (isOpen) void refresh();
  });

  function loadJson<T>(key: string, fallback: T): T {
    try {
      const text = localStorage.getItem(key);
      return text ? (JSON.parse(text) as T) : fallback;
    } catch {
      return fallback;
    }
  }

  function saveJson(key: string, value: unknown) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Remembering the choices is a convenience; a blocked storage loses only that.
    }
  }

  async function refresh() {
    status = await bridgeStatus();
    if (!status?.ok) return;
    try {
      files = await listFiles();
    } catch (error) {
      showToast(`biobuzz: ${(error as Error).message}`, "error");
      return;
    }
    const known = files.map((f) => f.path);
    target = suggestPpPath(fileName || "untitled.pp", openedFrom, known);
    openPath ||= target && known.includes(target) ? target : (known[0] ?? "");
    const saved = loadJson<Record<string, unknown>>(OPTIONS_KEY, {});
    if (typeof saved.design === "string") design = saved.design;
    if (typeof saved.partnerDesign === "string")
      partnerDesign = saved.partnerDesign;
    if (typeof saved.speed === "number") speed = saved.speed;
    if (typeof saved.partnerSpeed === "number")
      partnerSpeed = saved.partnerSpeed;
    if (typeof saved.partnerSameSpeed === "boolean")
      partnerSameSpeed = saved.partnerSameSpeed;
    if (typeof saved.seeds === "number") seeds = saved.seeds;
    if (saved.alliance === "RED" || saved.alliance === "BLUE")
      alliance = saved.alliance;
    const savedPartners = (saved.partners ?? {}) as Record<string, string>;
    partner = known.includes(savedPartners[target])
      ? savedPartners[target]
      : "";
  }

  async function open() {
    if (!openPath) return;
    try {
      onOpen(await readFile(openPath), openPath);
      target = openPath;
      showToast(`Opened ${openPath} from biobuzz`, "success");
    } catch (error) {
      showToast(
        `Could not open ${openPath}: ${(error as Error).message}`,
        "error",
      );
    }
  }

  async function go() {
    blocked = [];
    expanded = null;
    starting = true;
    const options = {
      design,
      partnerDesign,
      speed,
      partnerSpeed,
      partnerSameSpeed,
      seeds,
      alliance,
    };
    const remembered = loadJson<Record<string, unknown>>(OPTIONS_KEY, {});
    const partnersByTarget = {
      ...((remembered.partners ?? {}) as Record<string, string>),
      [target]: partner,
    };
    saveJson(OPTIONS_KEY, { ...options, partners: partnersByTarget });
    try {
      const started = await startRun({
        path: target.trim(),
        text: projectText(),
        partner: partner || null,
        design,
        partnerDesign: partnerDesign || null,
        partnerSpeed: partner && !partnerSameSpeed ? partnerSpeed : null,
        speed,
        seeds,
        alliance,
      });
      started.warnings.forEach((w) => showToast(`Export: ${w}`, "warning"));
      await poll(started.id);
    } catch (error) {
      if (error instanceof BridgeError && error.details.length)
        blocked = error.details;
      else showToast((error as Error).message, "error");
    } finally {
      starting = false;
    }
  }

  async function poll(id: string) {
    if (timer) clearTimeout(timer);
    try {
      run = await runStatus(id);
    } catch (error) {
      showToast((error as Error).message, "error");
      return;
    }
    if (run.state === "running") {
      timer = setTimeout(() => poll(id), 1000);
      return;
    }
    const known = run.result?.designs;
    if (known?.length) {
      designs = known;
      saveJson(DESIGNS_KEY, known);
    }
    files = await listFiles().catch(() => files);
  }

  async function download(file: string) {
    if (!run) return;
    try {
      await downloadLog(run.id, file);
    } catch (error) {
      showToast((error as Error).message, "error");
    }
  }

  function close() {
    isOpen = false;
  }

  const secs = (t: number) => `${t.toFixed(1)}`;
  const yesNo = (b: boolean) => (b ? "yes" : "no");
</script>

<Modal
  {isOpen}
  titleId="simulator-title"
  panelClass="console-panel p-6 w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto"
  onClose={close}
>
  <h2 id="simulator-title" class="text-xl font-semibold text-[#e8e8e8] mb-1">
    Simulator
  </h2>

  {#if !status}
    <p class="text-sm text-gray-300">Looking for the biobuzz bridge…</p>
  {:else if !status.ok}
    <p class="text-sm text-gray-300">
      {status.reason}. Start the Visualizer with
      <code>BIOBUZZ_DIR=/path/to/biobuzz npm run dev</code>, or clone biobuzz
      next to this checkout.
    </p>
  {:else}
    <p class="text-xs text-gray-400 mb-4">
      biobuzz at <code>{status.dir}</code>{#if status.branch}, branch <code
          >{status.branch}</code
        >{/if}
    </p>
    {#if !status.canRun}
      <p class="text-sm text-amber-300 mb-4">
        This branch has no <code>SimRunTest</code>, so it cannot run the
        simulation. Check out a branch that has it (the simulator's).
      </p>
    {/if}

    <div
      class="grid grid-cols-[9rem_1fr_auto] gap-x-3 gap-y-2 items-center text-sm text-gray-300"
    >
      <label for="sim-open">Open from biobuzz</label>
      <select
        id="sim-open"
        bind:value={openPath}
        class="console-input px-2 py-1"
      >
        {#each files as f (f.path)}
          <option value={f.path}>{f.path}</option>
        {/each}
      </select>
      <button
        class="console-action"
        onclick={open}
        disabled={!openPath || running}>Open</button
      >

      <label for="sim-target">Save and run as</label>
      <input
        id="sim-target"
        bind:value={target}
        list="sim-files"
        class="console-input px-2 py-1"
      />
      <span></span>

      <label for="sim-partner">Partner Auto</label>
      <select
        id="sim-partner"
        bind:value={partner}
        class="console-input px-2 py-1"
      >
        <option value="">none: our robot alone</option>
        {#each partners as f (f.path)}
          <option value={f.path}>{baseName(f.path)} ({f.autoClass})</option>
        {/each}
      </select>
      <span></span>

      <label for="sim-design">Our robot</label>
      <select
        id="sim-design"
        bind:value={design}
        class="console-input px-2 py-1"
      >
        {#each designs.includes(design) ? designs : [design, ...designs] as d (d)}
          <option value={d}>{d}</option>
        {/each}
      </select>
      <label class="flex items-center gap-2"
        ><input
          type="number"
          min="10"
          max="100"
          bind:value={speed}
          class="console-input w-16 px-2 py-1"
        /> in/s</label
      >

      {#if partner}
        <label for="sim-partner-design">Partner robot</label>
        <select
          id="sim-partner-design"
          bind:value={partnerDesign}
          class="console-input px-2 py-1"
        >
          <option value="">same as ours</option>
          {#each designs as d (d)}
            <option value={d}>{d}</option>
          {/each}
        </select>
        <span class="flex items-center gap-2">
          <label class="flex items-center gap-1"
            ><input type="checkbox" bind:checked={partnerSameSpeed} /> same speed</label
          >
          {#if !partnerSameSpeed}
            <input
              type="number"
              min="10"
              max="100"
              bind:value={partnerSpeed}
              class="console-input w-16 px-2 py-1"
            />
          {/if}
        </span>
      {/if}

      <label for="sim-seeds">Seeds</label>
      <span class="flex items-center gap-3">
        <input
          id="sim-seeds"
          type="number"
          min="1"
          max="50"
          bind:value={seeds}
          class="console-input w-16 px-2 py-1"
        />
        <label class="flex items-center gap-1"
          ><input type="radio" bind:group={alliance} value="RED" /> RED</label
        >
        <label class="flex items-center gap-1"
          ><input type="radio" bind:group={alliance} value="BLUE" /> BLUE</label
        >
      </span>
      <span></span>
    </div>
    <datalist id="sim-files">
      {#each files as f (f.path)}
        <option value={f.path}></option>
      {/each}
    </datalist>

    <div class="flex items-center justify-between gap-3 mt-4">
      <p class="text-xs text-gray-400">
        Saves this project to <code>{target}</code> in biobuzz, exports its Java
        next to the other generated Autos, and runs {seeds} seed{seeds === 1
          ? ""
          : "s"}. The first run builds TeamCode and can take a few minutes.
      </p>
      <button
        class="console-action console-action--accent shrink-0"
        onclick={go}
        disabled={running || !status.canRun || !target}
      >
        {running ? "Running…" : "Run in simulator"}
      </button>
    </div>

    {#if blocked.length}
      <div class="mt-4 text-sm text-red-300">
        <p class="font-semibold">Export blocked; nothing was saved or run:</p>
        <ul class="list-disc ml-5">
          {#each blocked as message, i (i)}<li>{message}</li>{/each}
        </ul>
      </div>
    {/if}

    {#if run}
      <div class="mt-5 border-t border-neutral-700 pt-4 text-sm text-gray-300">
        <p class="mb-2">
          <code>{run.spec}</code> ·
          {run.state === "running"
            ? `running, ${Math.round(run.seconds)} s`
            : `${run.state} in ${Math.round(run.seconds)} s`}
          · <code>{run.javaFile}</code>
        </p>

        {#if run.result?.error}
          <p class="text-red-300 mb-2">{run.result.error}</p>
        {/if}

        {#if run.state !== "done" || !runs.length}
          <pre
            class="text-xs bg-black/40 p-2 max-h-64 overflow-auto whitespace-pre-wrap">{run.output.join(
              "\n",
            )}</pre>
        {/if}

        {#if runs.length}
          <p class="mb-2">
            <strong>{summary.meanPoints.toFixed(1)}</strong> AUTO points on
            average over {summary.runs} seeds.
            {summary.tips
              .map(
                (tip, i) =>
                  `TIP ${i + 1} in ${tip.count} of ${summary.runs}, at ${secs(tip.meanAt)} s.`,
              )
              .join(" ")}
            LEAVE and PARK: {summary.parked} of {summary.robots} robot runs.
            {#if summary.withProblems}<span class="text-amber-300"
                >Problems in {summary.withProblems} of {summary.runs} seeds.</span
              >{/if}
          </p>
          <table class="w-full text-xs">
            <thead class="text-gray-400 text-left">
              <tr>
                <th class="py-1">Seed</th>
                <th>Points</th>
                <th>TIPs at (s)</th>
                <th>LEAVE / PARK</th>
                <th>Problems</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {#each runs as r (r.seed)}
                <tr
                  class="border-t border-neutral-800 cursor-pointer hover:bg-white/5"
                  onclick={() =>
                    (expanded = expanded === r.seed ? null : r.seed)}
                >
                  <td class="py-1"
                    >{r.seed}{r.seed === summary.typicalSeed ? " ★" : ""}</td
                  >
                  <td>{r.points}</td>
                  <td
                    >{r.tipsAt.length
                      ? r.tipsAt.map(secs).join(", ")
                      : "none"}</td
                  >
                  <td
                    >{r.robots
                      .map((x) => `${yesNo(x.leave)} / ${yesNo(x.park)}`)
                      .join(" · ")}</td
                  >
                  <td class="text-amber-300">{runProblems(r).join("; ")}</td>
                  <td class="text-right">
                    <button
                      class="console-action text-xs"
                      onclick={(e) => {
                        e.stopPropagation();
                        download(r.log);
                      }}>.wpilog</button
                    >
                  </td>
                </tr>
                {#if expanded === r.seed}
                  <tr>
                    <td colspan="6" class="pb-2">
                      {#each r.robots as robot (robot.auto)}
                        <p class="mt-2 font-semibold">
                          {robot.auto}: launched {robot.launched},
                          {robot.finishedAt === null
                            ? "still running at 30 s"
                            : `finished at ${secs(robot.finishedAt)} s`}
                          {#each robotProblems(robot) as p, i (i)}<span
                              class="text-amber-300">; {p}</span
                            >{/each}
                        </p>
                        <pre
                          class="whitespace-pre-wrap text-gray-400">{robot.timeline.join(
                            "\n",
                          )}</pre>
                      {/each}
                    </td>
                  </tr>
                {/if}
              {/each}
            </tbody>
          </table>
          <p class="text-xs text-gray-400 mt-3">
            ★ the median seed, the one to watch. In AdvantageScope open its <code
              >.wpilog</code
            >, then File → Import Layout with
            <code>sim-review/advantagescope-layout.json</code>; AUTO starts 10 s
            into the log. All the logs are in <code>{run.folder}</code>.
          </p>
        {/if}
      </div>
    {/if}
  {/if}

  <div class="flex justify-end gap-3 mt-5">
    <button onclick={close} class="console-action">Close</button>
  </div>
</Modal>
