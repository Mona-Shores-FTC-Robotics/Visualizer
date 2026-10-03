<script lang="ts">
  import Modal from "../components/ui/Modal.svelte";
  import { showToast } from "../toast";
  import { generateAutoJavaFromText } from "../codegen/auto/fromFile";
  import { autoClassName } from "../codegen/auto/javaAuto";
  import { gitHash, gitLinkFor } from "../../utils/gitLink";
  import { teamView } from "../team/teamView";
  import {
    GitHubError,
    branchHead,
    commitFiles,
    commitUrl,
    listFiles,
    readBytes,
    readText,
    runsFor,
    saveToken,
    savedToken,
    whoAmI,
    type WorkflowRun,
  } from "../github/api";
  import {
    DEFAULT_BRANCH,
    DEFAULT_DESIGN,
    PP_DIRS,
    SIM_REQUEST_PATH,
    SIM_RESULTS_BRANCH,
    SIM_WORKFLOW,
    baseName,
    generatedPathFor,
    ppPathProblem,
    protectedBranch,
    robotProblems,
    runProblems,
    simLatestPath,
    simLogPath,
    simRequestText,
    simResultPath,
    simSpec,
    suggestPpPath,
    tally,
    type SimResult,
  } from "./biobuzz";

  interface Props {
    isOpen?: boolean;
    /** The file open in the editor, e.g. "recycle5-left.pp" (empty if none). */
    fileName: string;
    /** Where in biobuzz the open project was read from, if it was. */
    source: { ref: string | null; path: string } | null;
    /** The open project as it would be saved. */
    projectText: () => string;
    /**
     * The file's text on GitHub when the draft on screen began, if it is one: a
     * save first checks GitHub still has it, so nobody's change is replaced unseen.
     */
    baseText?: string | null;
    /** The draft on screen, if the project is one: where it stands, for the top of the dialog. */
    draft?: {
      label: string;
      status: "same" | "edited" | "newer-on-github" | "edited-and-newer";
      from: number | null;
    } | null;
    /** Throws the draft away and loads GitHub's version. */
    onDiscard?: () => void;
    /** After a save: the project now is that file on that branch, exactly `text`. */
    onSaved: (branch: string, path: string, text: string) => void;
  }

  let {
    isOpen = $bindable(false),
    fileName,
    source,
    projectText,
    baseText = null,
    draft = null,
    onDiscard,
    onSaved,
  }: Props = $props();

  const OPTIONS_KEY = "githubSimOptions";
  const DESIGNS_KEY = "githubSimDesigns";
  const PENDING_KEY = "githubSimPending";

  let token = $state<string | null>(savedToken());
  let login = $state<string | null>(null);
  let tokenInput = $state("");
  let checkingToken = $state(false);

  let branch = $state(DEFAULT_BRANCH);
  let path = $state("");
  let files = $state<string[]>([]);
  let partner = $state("");
  let design = $state(DEFAULT_DESIGN);
  let partnerDesign = $state("");
  let speed = $state(50);
  let seeds = $state(10);
  let alliance = $state<"RED" | "BLUE">("RED");
  let designs = $state<string[]>(loadJson(DESIGNS_KEY, [DEFAULT_DESIGN]));

  let saving = $state(false);
  let blocked = $state<string[]>([]);
  /** The commit being simulated, or the one whose result is shown. */
  let commit = $state<string | null>(null);
  let commitPath = "";
  let run = $state<WorkflowRun | null>(null);
  let result = $state<SimResult | null>(null);
  /** The newest earlier result for this file, shown before anything is saved. */
  let latest = $state<SimResult | null>(null);
  let expanded = $state<number | null>(null);
  let timer: ReturnType<typeof setTimeout> | null = null;
  let polls = 0;

  let pathProblem = $derived(
    path.trim()
      ? ppPathProblem(path.trim())
      : "Choose the file to save to: pick one from the list, or type a new name in " +
          PP_DIRS.join(" or "),
  );
  let ppFiles = $derived(
    files.filter(
      (f) => f.endsWith(".pp") && PP_DIRS.some((d) => f.startsWith(`${d}/`)),
    ),
  );
  /** Saving would create a file biobuzz does not have yet. */
  let isNew = $derived(files.length > 0 && !ppFiles.includes(path.trim()));
  let partners = $derived(ppFiles.filter((f) => f !== path.trim()));
  let shown = $derived(result ?? latest);
  let runs = $derived(shown?.runs ?? []);
  let summary = $derived(tally(runs));
  let waiting = $derived(commit !== null && result === null);

  $effect(() => {
    if (isOpen) void opened();
    else stopPolling();
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
      // Remembering choices is a convenience; blocked storage loses only that.
    }
  }

  async function opened() {
    const saved = loadJson<Record<string, unknown>>(OPTIONS_KEY, {});
    if (typeof saved.design === "string") design = saved.design;
    if (typeof saved.partnerDesign === "string")
      partnerDesign = saved.partnerDesign;
    if (typeof saved.speed === "number") speed = saved.speed;
    if (typeof saved.seeds === "number") seeds = saved.seeds;
    if (saved.alliance === "RED" || saved.alliance === "BLUE")
      alliance = saved.alliance;
    const fromBranch =
      source?.ref &&
      !protectedBranch(source.ref) &&
      !/^[0-9a-f]{7,40}$/.test(source.ref);
    branch = fromBranch
      ? source!.ref!
      : typeof saved.branch === "string"
        ? saved.branch
        : DEFAULT_BRANCH;

    if (token && !login) {
      try {
        login = await whoAmI(token);
      } catch (error) {
        showToast((error as Error).message, "error");
        login = null;
      }
    }
    await loadBranch();
    const partners = (saved.partners ?? {}) as Record<string, string>;
    partner = ppFiles.includes(partners[path]) ? partners[path] : "";

    // A save still being simulated when the dialog was closed: pick it up again.
    const pending = loadJson<{ path: string; commit: string } | null>(
      PENDING_KEY,
      null,
    );
    if (pending && pending.path === path) {
      commit = pending.commit;
      commitPath = pending.path;
      result = null;
      void poll();
    } else if (!commit) {
      void loadLatest();
    }
  }

  async function loadBranch() {
    try {
      files = await listFiles(token, await branchHead(token, branch));
    } catch (error) {
      files = [];
      showToast(
        `Could not read ${branch}: ${(error as Error).message}`,
        "error",
      );
    }
    path = suggestPpPath(fileName, source?.path ?? null, ppFiles);
  }

  async function loadLatest() {
    latest = null;
    try {
      const text = await readText(
        token,
        simLatestPath(path),
        SIM_RESULTS_BRANCH,
      );
      const parsed = text ? (JSON.parse(text) as SimResult) : null;
      // latest.json is per file name; only show it for this file.
      if (parsed && parsed.pp === path) {
        latest = parsed;
        rememberDesigns(parsed);
        adoptSettings(parsed);
      }
    } catch {
      // No earlier result: nothing to show.
    }
  }

  /**
   * Simulate the same way as last time unless chosen otherwise, so a changed
   * Auto is compared like for like: its partner, robots, seeds and alliance.
   */
  function adoptSettings(r: SimResult) {
    const [autos, at] = (r.spec ?? "").split("@");
    const partnerClass = autos?.split(",")[1];
    if (partnerClass) {
      partner =
        ppFiles.find((f) => autoClassName(baseName(f)) === partnerClass) ??
        partner;
    }
    if (r.design) design = r.design;
    partnerDesign =
      r.partnerDesign && r.partnerDesign !== r.design ? r.partnerDesign : "";
    if (Number(at) > 0) speed = Number(at);
    if (r.runs?.length) seeds = r.runs.length;
    if (r.alliance === "RED" || r.alliance === "BLUE") alliance = r.alliance;
  }

  function rememberDesigns(r: SimResult) {
    if (r.designs?.length) {
      designs = r.designs;
      saveJson(DESIGNS_KEY, r.designs);
    }
  }

  async function useToken() {
    const t = tokenInput.trim();
    if (!t) return;
    checkingToken = true;
    try {
      login = await whoAmI(t);
      token = t;
      saveToken(t);
      tokenInput = "";
      await loadBranch();
      void loadLatest();
    } catch (error) {
      showToast((error as Error).message, "error");
    } finally {
      checkingToken = false;
    }
  }

  function forgetToken() {
    saveToken(null);
    token = null;
    login = null;
  }

  async function save() {
    if (!token || !login) return;
    const ppPath = path.trim();
    blocked = [];
    if (pathProblem) return void (blocked = [pathProblem]);
    if (protectedBranch(branch))
      return void (blocked = [`Save to a working branch, not ${branch}.`]);
    if (
      isNew &&
      !confirm(
        `${ppPath} is not in biobuzz on ${branch} yet. Save the project on screen as a new Auto there?`,
      )
    ) {
      return;
    }
    saving = true;
    try {
      const text = projectText();
      const exported = generateAutoJavaFromText(text, baseName(ppPath));
      if (!exported.ok) {
        blocked = exported.errors;
        return;
      }
      let head = await branchHead(token, branch);
      // Someone else's change since this draft began is not replaced without asking.
      if (
        baseText !== null &&
        source &&
        ppPath === source.path &&
        (source.ref ?? branch) === branch
      ) {
        const onGithub = await readText(token, ppPath, head);
        if (
          onGithub !== null &&
          onGithub !== baseText &&
          !confirm(
            `${baseName(ppPath)} changed on ${branch} since you started editing it. Replace that version with yours?\n\n` +
              "Cancel saves nothing and keeps your draft as it is.",
          )
        ) {
          return;
        }
      }
      const existing = await listFiles(token, head);
      let partnerClass: string | null = null;
      if (partner) {
        const partnerText = await readText(token, partner, head);
        const exportName = partnerText
          ? JSON.parse(partnerText)?.auto?.exportName
          : null;
        partnerClass = autoClassName(exportName || baseName(partner));
        if (
          !existing.some((f) => f.endsWith(`/generated/${partnerClass}.java`))
        ) {
          blocked = [
            `${baseName(partner)} has no exported Java on ${branch} yet: save it to GitHub first.`,
          ];
          return;
        }
      }
      const javaPath = generatedPathFor(ppPath, exported.fileName, existing);
      const spec = simSpec(exported.className, partnerClass, speed);
      const files = {
        [ppPath]: text,
        [javaPath]: exported.source,
        [SIM_REQUEST_PATH]: simRequestText({
          ppPath,
          spec,
          design,
          partnerDesign: partner && partnerDesign ? partnerDesign : null,
          partnerSpeed: null,
          seeds,
          alliance,
          savedBy: login,
        }),
      };
      const message = `Auto Builder: ${baseName(ppPath)}\n\nSaved from the Visualizer by ${login}; simulates ${spec}.`;
      let sha: string;
      try {
        sha = await commitFiles(token, branch, head, files, message);
      } catch (error) {
        // Someone pushed in between: once more on top of theirs.
        if (
          !(error instanceof GitHubError) ||
          (error.status !== 422 && error.status !== 409)
        )
          throw error;
        head = await branchHead(token, branch);
        sha = await commitFiles(token, branch, head, files, message);
      }
      saveJson(OPTIONS_KEY, {
        design,
        partnerDesign,
        speed,
        seeds,
        alliance,
        branch,
        partners: {
          ...(loadJson<Record<string, unknown>>(OPTIONS_KEY, {}).partners ??
            {}),
          [ppPath]: partner,
        },
      });
      saveJson(PENDING_KEY, { path: ppPath, commit: sha });
      exported.warnings.forEach((w) => showToast(`Export: ${w}`, "warning"));
      showToast(`Saved ${baseName(ppPath)} to ${branch}`, "success");
      onSaved(branch, ppPath, text);
      commit = sha;
      commitPath = ppPath;
      result = null;
      run = null;
      polls = 0;
      void poll();
    } catch (error) {
      showToast((error as Error).message, "error");
    } finally {
      saving = false;
    }
  }

  function stopPolling() {
    if (timer) clearTimeout(timer);
    timer = null;
  }

  async function poll() {
    stopPolling();
    if (!commit) return;
    polls++;
    try {
      const runs = await runsFor(token, commit);
      run = runs.find((r) => r.name === SIM_WORKFLOW) ?? null;
      if (run?.status === "completed") {
        const text = await readText(
          token,
          simResultPath(commitPath, commit),
          SIM_RESULTS_BRANCH,
        );
        if (text) {
          result = JSON.parse(text) as SimResult;
          rememberDesigns(result);
          saveJson(PENDING_KEY, null);
          return;
        }
      }
    } catch (error) {
      if (polls % 6 === 1)
        showToast(
          `Checking the simulation: ${(error as Error).message}`,
          "warning",
        );
    }
    // Every 5 s for 20 minutes; GitHub takes a moment to even list the run.
    if (isOpen && polls < 240) timer = setTimeout(poll, 5000);
  }

  async function download(r: SimResult, file: string) {
    try {
      const blob = await readBytes(
        token,
        simLogPath(r, file),
        SIM_RESULTS_BRANCH,
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      showToast(
        `Could not download ${file}: ${(error as Error).message}`,
        "error",
      );
    }
  }

  async function copyVersionLink(r: SimResult) {
    const link = `${location.origin}${location.pathname}${gitHash(gitLinkFor(r.commit, r.pp))}`;
    try {
      await navigator.clipboard.writeText(link);
      showToast("Copied a link to exactly this version", "success");
    } catch {
      window.prompt("A link to exactly this version:", link);
    }
  }

  /** Opens one of Team Autos' files on its own, as a copy that Save to GitHub saves back. */
  function editTeamFile(file: string) {
    const view = $teamView;
    if (!view) return;
    location.hash = gitHash(gitLinkFor(view.ref, `TeamCode/autos/${file}`));
    close();
  }

  function close() {
    isOpen = false;
  }

  const secs = (t: number) => t.toFixed(1);
  const yesNo = (b: boolean) => (b ? "yes" : "no");
  /** A published log's button label: which run it is. */
  function logLabel(seed: number): string {
    const best = seed === (shown?.bestSeed ?? summary.best?.seed);
    const typical = seed === shown?.typicalSeed;
    const what =
      best && typical
        ? "best and typical"
        : best
          ? "best"
          : typical
            ? "typical"
            : "seed";
    return `${what}, seed ${seed}`;
  }
  const when = (iso: string) => new Date(iso).toLocaleString();
</script>

<Modal
  {isOpen}
  titleId="github-save-title"
  panelClass="console-panel p-6 w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto"
  onClose={close}
>
  <h2 id="github-save-title" class="text-xl font-semibold text-[#e8e8e8] mb-1">
    Save to GitHub and simulate
  </h2>

  {#if draft && source}
    <div class="flex items-center justify-between gap-3 text-sm my-3">
      <p class="text-gray-300">
        <code>{source.path}</code> on {source.ref ?? "the default branch"}:
        <span
          class={draft.status === "same" ? "text-gray-400" : "text-amber-300"}
          >{draft.label}</span
        >{#if draft.from && draft.status !== "same"}<span class="text-gray-400"
            >&nbsp;(edits from {new Date(draft.from).toLocaleString()})</span
          >{/if}. Edits are kept in this browser until you save them here.
      </p>
      {#if draft.status !== "same" && onDiscard}
        <button
          class="console-action shrink-0"
          onclick={() => {
            close();
            onDiscard();
          }}
          >{draft.status === "newer-on-github"
            ? "Load GitHub's version"
            : "Discard my edits"}</button
        >
      {/if}
    </div>
  {/if}

  {#if $teamView && !source}
    <div
      class="text-sm text-amber-200 border border-amber-300/40 rounded p-3 my-3"
    >
      <p>
        Team Autos is showing {$teamView.files.join(", ")} to watch. Those are not
        what this saves: it saves the project you are editing. To change one of them,
        open it on its own first:
      </p>
      <div class="flex flex-wrap gap-2 mt-2">
        {#each $teamView.files as file (file)}
          <button
            class="console-action text-xs"
            onclick={() => editTeamFile(file)}>Edit {file}</button
          >
        {/each}
      </div>
    </div>
  {/if}

  {#if token && login}
    <p class="text-xs text-gray-400 mb-4">
      Signed in to GitHub as <b>{login}</b> ·
      <button class="underline" onclick={forgetToken}>forget the token</button>
    </p>
  {:else}
    <p class="text-xs text-gray-400 mb-4">
      Anyone can see the last simulation; saving needs a GitHub token.
    </p>
  {/if}
  <div
    class="grid grid-cols-[8rem_1fr_auto] gap-x-3 gap-y-2 items-center text-sm text-gray-300"
  >
    <label for="gh-branch">Branch</label>
    <input
      id="gh-branch"
      bind:value={branch}
      class="console-input px-2 py-1"
      onchange={loadBranch}
    />
    <span></span>

    <label for="gh-path">File</label>
    <input
      id="gh-path"
      bind:value={path}
      list="gh-files"
      class="console-input px-2 py-1"
      onchange={loadLatest}
    />
    <span></span>

    <label for="gh-partner">Partner Auto</label>
    <select
      id="gh-partner"
      bind:value={partner}
      class="console-input px-2 py-1"
    >
      <option value="">none: our robot alone</option>
      {#each partners as f (f)}
        <option value={f}>{baseName(f)}</option>
      {/each}
    </select>
    <span></span>

    <label for="gh-design">Our robot</label>
    <select id="gh-design" bind:value={design} class="console-input px-2 py-1">
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
      <label for="gh-partner-design">Partner robot</label>
      <select
        id="gh-partner-design"
        bind:value={partnerDesign}
        class="console-input px-2 py-1"
      >
        <option value="">same as ours</option>
        {#each designs as d (d)}
          <option value={d}>{d}</option>
        {/each}
      </select>
      <span></span>
    {/if}

    <label for="gh-seeds">Seeds</label>
    <span class="flex items-center gap-3">
      <input
        id="gh-seeds"
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
  <datalist id="gh-files">
    {#each ppFiles as f (f)}
      <option value={f}></option>
    {/each}
  </datalist>

  {#if token && login}
    <div class="flex items-center justify-between gap-3 mt-4">
      <p class="text-xs {pathProblem ? 'text-amber-300' : 'text-gray-400'}">
        {#if pathProblem}
          {pathProblem}.
        {:else}
          One commit on <code>{branch}</code>: <code>{path}</code>
          {#if isNew}<strong class="text-amber-300">(a new file)</strong
            >{:else}(updated){/if}, its Java, and the simulation request. GitHub
          then runs
          {seeds} seed{seeds === 1 ? "" : "s"}, usually in 1–6 minutes; you can
          keep working meanwhile.
        {/if}
      </p>
      <button
        class="console-action console-action--accent shrink-0"
        onclick={save}
        disabled={saving || waiting || !!pathProblem}
      >
        {saving ? "Saving…" : "Save to GitHub"}
      </button>
    </div>
  {:else}
    <div class="text-sm text-gray-300 flex flex-col gap-2 mt-3">
      <p>
        Saving to GitHub needs a token that lets this page write to biobuzz. You
        make it once; it stays in this browser only.
      </p>
      <ol class="list-decimal ml-5 flex flex-col gap-1">
        <li>
          Open <a
            class="underline"
            href="https://github.com/settings/personal-access-tokens/new"
            target="_blank"
            rel="noreferrer">GitHub → new fine-grained token</a
          >.
        </li>
        <li>
          Resource owner: <b>Mona-Shores-FTC-Robotics</b>. Expiration: up to a
          year.
        </li>
        <li>Repository access: <b>Only select repositories → biobuzz</b>.</li>
        <li>
          Permissions: <b>Contents: Read and write</b>,
          <b>Actions: Read-only</b>.
        </li>
        <li>Generate it, copy it, and paste it here.</li>
      </ol>
      <p class="text-xs text-gray-400">
        If GitHub says the token needs approval, an organization owner approves
        it once under the organization's Settings → Personal access tokens.
      </p>
      <div class="flex gap-2">
        <input
          type="password"
          bind:value={tokenInput}
          placeholder="github_pat_…"
          class="console-input px-2 py-1 flex-1"
          onkeydown={(e) => e.key === "Enter" && useToken()}
        />
        <button
          class="console-action console-action--accent"
          onclick={useToken}
          disabled={checkingToken}
        >
          {checkingToken ? "Checking…" : "Use this token"}
        </button>
      </div>
    </div>
  {/if}

  {#if blocked.length}
    <div class="mt-4 text-sm text-red-300">
      <p class="font-semibold">Not saved:</p>
      <ul class="list-disc ml-5">
        {#each blocked as message, i (i)}<li>{message}</li>{/each}
      </ul>
    </div>
  {/if}

  {#if waiting && commit}
    <div class="mt-5 border-t border-neutral-700 pt-4 text-sm text-gray-300">
      <p>
        Saved as <a
          class="underline"
          href={commitUrl(commit)}
          target="_blank"
          rel="noreferrer"><code>{commit.slice(0, 7)}</code></a
        >.
        {#if !run}
          Waiting for GitHub to start the simulation…
        {:else if run.status !== "completed"}
          Simulating ({run.status.replace("_", " ")})…
        {:else}
          The run finished ({run.conclusion}); fetching its result…
        {/if}
        {#if run}<a
            class="underline"
            href={run.html_url}
            target="_blank"
            rel="noreferrer">Watch it on GitHub</a
          >{/if}
      </p>
    </div>
  {/if}

  {#if shown}
    <div class="mt-5 border-t border-neutral-700 pt-4 text-sm text-gray-300">
      <p class="mb-2">
        {result ? "Simulated" : "Last simulated"}
        <code>{shown.spec ?? shown.auto}</code>
        at
        <a
          class="underline"
          href={commitUrl(shown.commit)}
          target="_blank"
          rel="noreferrer"><code>{shown.commit.slice(0, 7)}</code></a
        >
        on {shown.branch}, {when(shown.finishedAt)} ·
        <a
          class="underline"
          href={shown.runUrl}
          target="_blank"
          rel="noreferrer">run</a
        >
        ·
        <button class="underline" onclick={() => copyVersionLink(shown!)}
          >copy a link to this version</button
        >
        {#if !result && latest}<br /><span class="text-xs text-gray-400"
            >From before your changes on screen: Save to GitHub to simulate
            them.</span
          >{/if}
      </p>

      {#if shown.error}
        <p class="text-red-300 mb-2">{shown.error}</p>
      {/if}

      {#if runs.length}
        {#if summary.best}
          <p class="mb-1 text-base">
            Best: <strong>{summary.best.points}</strong> AUTO points (seed {summary
              .best.seed}),
            {summary.best.autoTips} TIP{summary.best.autoTips === 1
              ? ""
              : "s"}{#if summary.best.autoTips}&nbsp;at {summary.best.tipsAt
                .slice(0, summary.best.autoTips)
                .map(secs)
                .join(", ")} s{/if}, LEAVE / PARK {summary.best.robots
              .map((x) => `${yesNo(x.leave)} / ${yesNo(x.park)}`)
              .join(" · ")}.
          </p>
        {/if}
        <p class="mb-3 text-gray-400">
          Over {summary.runs} seeds: {summary.meanPoints.toFixed(1)} points on average.
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
        <div class="flex flex-wrap gap-2 mb-3">
          {#each Object.entries(shown.logs) as [seed, file] (seed)}
            <button
              class="console-action {Number(seed) ===
              (shown.bestSeed ?? summary.best?.seed)
                ? 'console-action--accent'
                : ''}"
              onclick={() => download(shown!, file)}
              title={file}>Download WPILOG ({logLabel(Number(seed))})</button
            >
          {/each}
        </div>
        <table class="w-full text-xs">
          <thead class="text-gray-400 text-left">
            <tr>
              <th class="py-1">Seed</th>
              <th>Points</th>
              <th>TIPs at (s)</th>
              <th>LEAVE / PARK</th>
              <th>Problems</th>
            </tr>
          </thead>
          <tbody>
            {#each runs as r (r.seed)}
              <tr
                class="border-t border-neutral-800 cursor-pointer hover:bg-white/5"
                onclick={() => (expanded = expanded === r.seed ? null : r.seed)}
              >
                <td class="py-1"
                  >{r.seed}{r.seed === (shown.bestSeed ?? summary.best?.seed)
                    ? " ▲"
                    : ""}{r.seed === shown.typicalSeed ? " ★" : ""}</td
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
              </tr>
              {#if expanded === r.seed}
                <tr>
                  <td colspan="5" class="pb-2">
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
          ▲ the best seed, ★ the median one: both logs are published. In
          AdvantageScope open one, then File → Import Layout with biobuzz's <code
            >sim-review/advantagescope-layout.json</code
          >; AUTO starts 10 s into the log. Its Metadata tab names the commit
          and .pp it simulated.
        </p>
      {/if}
    </div>
  {/if}

  <div class="flex justify-end gap-3 mt-5">
    <button onclick={close} class="console-action">Close</button>
  </div>
</Modal>
