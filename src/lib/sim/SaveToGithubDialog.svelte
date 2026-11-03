<script lang="ts">
  import Modal from "../components/ui/Modal.svelte";
  import { showToast } from "../toast";
  import { generateAutoJavaFromText } from "../codegen/auto/fromFile";
  import { gitHash, gitLinkFor } from "../../utils/gitLink";
  import { teamView } from "../team/teamView";
  import {
    GitHubError,
    branchHead,
    branchHeadOrNull,
    commitFiles,
    createBranch,
    createPull,
    moveBranch,
    openPullFrom,
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
    FAST_LANE_BASE,
    PP_DIRS,
    SAVE_SEEDS,
    SIM_RESULTS_BRANCH,
    SIM_WORKFLOW,
    baseName,
    generatedPathFor,
    laneBranch,
    parseSimRequest,
    ppPathProblem,
    protectedBranch,
    robotProblems,
    runKey,
    runLabel,
    runProblems,
    simLatestPath,
    simLogPath,
    simOwnRequestPath,
    simPlanSentence,
    simRequestText,
    simRequestPath,
    simResultPath,
    simRuns,
    simSpec,
    suggestPpPath,
    tally,
    type SimRequest,
    type SimResult,
    type SimRunPlan,
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
  const PENDING_KEY = "githubSimPending";

  let token = $state<string | null>(savedToken());
  let login = $state<string | null>(null);
  let tokenInput = $state("");
  let checkingToken = $state(false);

  let branch = $state(DEFAULT_BRANCH);
  let path = $state("");
  let files = $state<string[]>([]);

  /**
   * What a save will simulate: the runs in the Auto's request on biobuzz (alone, and one per partner
   * stand-in a mentor curated), or the Auto alone when it has no request yet.
   */
  let plan = $state<SimRunPlan[]>([{ partner: null }]);
  /** The branch the request was read from, or null when biobuzz has none for this Auto. */
  let planFrom = $state<string | null>(null);

  let saving = $state(false);
  /** The fast-lane pull request the last save went into, and whether GitHub will merge it by itself. */
  let pull = $state<{ url: string; number: number } | null>(null);
  /** Master, or a fast-lane branch: the save goes to master through a pull request that merges itself. */
  let viaFastLane = $derived(
    branch.trim() === FAST_LANE_BASE || branch.trim().startsWith("auto/"),
  );
  let blocked = $state<string[]>([]);
  /** The commit being simulated, or the one whose results are shown. */
  let commit = $state<string | null>(null);
  let commitPath = $state("");
  let run = $state<WorkflowRun | null>(null);
  /** The saved commit's results, one per run of the plan (its key), once published. */
  let resultByRun = $state<Record<string, SimResult>>({});
  /** The newest earlier results for this file, one per run, shown before anything is saved. */
  let latestByRun = $state<Record<string, SimResult>>({});
  /** The run whose seeds are open (its key), and the seed whose timeline is. */
  let selected = $state<string | null>(null);
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
  let hasResult = $derived(Object.keys(resultByRun).length > 0);
  let waiting = $derived(commit !== null && !hasResult);
  /** One row per run of the plan: what to show for it (this save's result, else the last one). */
  let rows = $derived(
    plan.map((r) => {
      const key = runKey(r);
      const shown = resultByRun[key] ?? latestByRun[key] ?? null;
      return { key, run: r, shown, summary: tally(shown?.runs ?? []) };
    }),
  );
  let anyShown = $derived(rows.some((row) => row.shown !== null));
  /** The row whose seeds are open: the chosen one, or the only one. */
  let selectedRow = $derived(
    rows.find((row) => row.key === selected) ??
      (rows.length === 1 && rows[0].shown ? rows[0] : null),
  );

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
    const fromBranch =
      source?.ref &&
      !protectedBranch(source.ref) &&
      !/^[0-9a-f]{7,40}$/.test(source.ref);
    branch = fromBranch
      ? source!.ref!
      : typeof saved.branch === "string" && saved.branch !== "claude/simulator"
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
    await loadPlan();

    // A save still being simulated when the dialog was closed: pick it up again.
    const pending = loadJson<{ path: string; commit: string } | null>(
      PENDING_KEY,
      null,
    );
    if (pending && pending.path === path) {
      commit = pending.commit;
      commitPath = pending.path;
      resultByRun = {};
      void poll();
    } else if (!commit) {
      void loadLatest();
    }
  }

  async function loadBranch() {
    try {
      // A fast-lane branch is gone once its pull request merged (or not made yet): master then.
      const at = viaFastLane
        ? ((await branchHeadOrNull(token, branch.trim())) ??
          (await branchHead(token, FAST_LANE_BASE)))
        : await branchHead(token, branch);
      files = await listFiles(token, at);
    } catch (error) {
      files = [];
      showToast(
        `Could not read ${branch}: ${(error as Error).message}`,
        "error",
      );
    }
    path = suggestPpPath(fileName, source?.path ?? null, ppFiles);
  }

  /** The file changed: what biobuzz will run for it, and what it last ran. */
  async function pathChanged() {
    await loadPlan();
    await loadLatest();
  }

  /**
   * The Auto's request as biobuzz has it, at `ref` (a branch or a commit), else on master; null
   * when it has none yet. Where it was found comes back too.
   */
  async function existingRequest(
    ppPath: string,
    ref: string,
  ): Promise<{ request: SimRequest; from: string } | null> {
    const own = simOwnRequestPath(ppPath);
    const onRef = parseSimRequest(await readText(token, own, ref));
    if (onRef) return { request: onRef, from: ref };
    if (ref === FAST_LANE_BASE) return null;
    const onMaster = parseSimRequest(
      await readText(token, own, FAST_LANE_BASE),
    );
    return onMaster ? { request: onMaster, from: FAST_LANE_BASE } : null;
  }

  /** The branch a save of `path` lands on, as it stands now: the lane branch while it exists, else master. */
  async function saveRef(ppPath: string): Promise<string> {
    if (!viaFastLane) return branch.trim();
    const lane = laneBranch(ppPath);
    return (await branchHeadOrNull(token, lane)) === null
      ? FAST_LANE_BASE
      : lane;
  }

  async function loadPlan() {
    const ppPath = path.trim();
    plan = [{ partner: null }];
    planFrom = null;
    selected = null;
    if (!ppPath || ppPathProblem(ppPath)) return;
    try {
      const found = await existingRequest(ppPath, await saveRef(ppPath));
      if (found && path.trim() === ppPath) {
        plan = simRuns(found.request);
        planFrom = found.from;
      }
    } catch {
      // No request to read (offline, or a rate limit): the Auto alone, which is what biobuzz would run.
    }
  }

  async function loadLatest() {
    latestByRun = {};
    const ppPath = path.trim();
    const found: Record<string, SimResult> = {};
    await Promise.all(
      plan.map(async (r) => {
        try {
          const text = await readText(
            token,
            simLatestPath(ppPath, r.partner),
            SIM_RESULTS_BRANCH,
          );
          const parsed = text ? (JSON.parse(text) as SimResult) : null;
          // latest.json is per file name; only show it for this file.
          if (parsed && parsed.pp === ppPath) found[runKey(r)] = parsed;
        } catch {
          // No earlier result: nothing to show.
        }
      }),
    );
    if (path.trim() === ppPath) latestByRun = found;
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
      void pathChanged();
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
    if (protectedBranch(branch) && !viaFastLane)
      return void (blocked = [`Save to a working branch, not ${branch}.`]);
    const target = viaFastLane ? laneBranch(ppPath) : branch;
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
      // The fast lane: the Auto's own branch, from master unless its pull request is still open.
      let open = viaFastLane
        ? await openPullFrom(token, target, FAST_LANE_BASE)
        : null;
      let head: string;
      if (!viaFastLane || open) {
        head = await branchHead(token, target);
      } else {
        head = await branchHead(token, FAST_LANE_BASE);
        if ((await branchHeadOrNull(token, target)) === null)
          await createBranch(token, target, head);
        else await moveBranch(token, target, head);
      }
      // Someone else's change since this draft began is not replaced without asking.
      const sameRef = viaFastLane
        ? [FAST_LANE_BASE, target].includes(source?.ref ?? FAST_LANE_BASE)
        : (source?.ref ?? branch) === branch;
      if (baseText !== null && source && ppPath === source.path && sameRef) {
        const onGithub = await readText(token, ppPath, head);
        if (
          onGithub !== null &&
          onGithub !== baseText &&
          !confirm(
            `${baseName(ppPath)} changed on ${target} since you started editing it. Replace that version with yours?\n\n` +
              "Cancel saves nothing and keeps your draft as it is.",
          )
        ) {
          return;
        }
      }
      const existing = await listFiles(token, head);
      const javaPath = generatedPathFor(ppPath, exported.fileName, existing);
      const spec = simSpec(exported.className);
      // biobuzz's request for this Auto, as of the commit being built on: its runs are kept.
      const previous = await existingRequest(ppPath, head);
      plan = simRuns(previous?.request ?? null);
      planFrom = previous?.from ?? null;
      const files = {
        [ppPath]: text,
        [javaPath]: exported.source,
        [simRequestPath(ppPath, viaFastLane)]: simRequestText({
          ppPath,
          spec,
          savedBy: login,
          existing: previous?.request ?? null,
        }),
      };
      const simulates = `${spec} ${plan.map(runLabel).join(", ")}`;
      const message = `Auto Builder: ${baseName(ppPath)}\n\nSaved from the Visualizer by ${login}; simulates ${simulates}.`;
      let sha: string;
      try {
        sha = await commitFiles(token, target, head, files, message);
      } catch (error) {
        // Someone pushed in between: once more on top of theirs.
        if (
          !(error instanceof GitHubError) ||
          (error.status !== 422 && error.status !== 409)
        )
          throw error;
        head = await branchHead(token, target);
        sha = await commitFiles(token, target, head, files, message);
      }
      pull = null;
      if (viaFastLane) {
        // The draft waits: it is tried on the robot first, and a mentor merges it on GitHub if it
        // is better. Auto-merge would land it as soon as its checks pass, before anyone drove it.
        if (!open) {
          open = await createPull(
            token,
            target,
            FAST_LANE_BASE,
            `Auto: ${baseName(ppPath)}`,
            `Saved from the Visualizer by ${login}: \`${ppPath}\`, its generated Java and its simulation request (simulates ${simulates}).\n\n` +
              "Fast lane: an Auto-only change, so it needs no issue or review. Try it on the robot; merge it here if it is better than master's. Simulated points are shown, never enforced.",
          );
        }
        pull = { url: open.html_url, number: open.number };
      }
      saveJson(OPTIONS_KEY, { branch });
      saveJson(PENDING_KEY, { path: ppPath, commit: sha });
      exported.warnings.forEach((w) => showToast(`Export: ${w}`, "warning"));
      showToast(
        pull
          ? `Saved ${baseName(ppPath)} to pull request #${pull.number}: try it on the robot, then merge it on GitHub if it is better`
          : `Saved ${baseName(ppPath)} to ${branch}`,
        "success",
      );
      onSaved(target, ppPath, text);
      commit = sha;
      commitPath = ppPath;
      resultByRun = {};
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
        const found: Record<string, SimResult> = {};
        await Promise.all(
          plan.map(async (r) => {
            const text = await readText(
              token,
              simResultPath(commitPath, commit!, r.partner),
              SIM_RESULTS_BRANCH,
            );
            if (text) found[runKey(r)] = JSON.parse(text) as SimResult;
          }),
        );
        if (Object.keys(found).length) {
          resultByRun = found;
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

  /** biobuzz's AdvantageScope layout for match logs, which also shows a simulated log's robot and path. */
  const LAYOUT_PATH = "tools/advantagescope/match-layout.json";

  async function downloadLayout() {
    try {
      const blob = await readBytes(token, LAYOUT_PATH, "master");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "biobuzz-match-layout.json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      showToast(
        `Could not download the layout: ${(error as Error).message}`,
        "error",
      );
    }
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
  /** The seed a result calls its best: its own word, else the tally's. */
  function bestSeed(row: (typeof rows)[number]): number | null {
    return row.shown?.bestSeed ?? row.summary.best?.seed ?? null;
  }
  /** A published log's button label: which seed it is. */
  function logLabel(row: (typeof rows)[number], seed: number): string {
    const best = seed === bestSeed(row);
    const typical = seed === row.shown?.typicalSeed;
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
  <h2 id="github-save-title" class="text-xl font-semibold text-heading mb-1">
    Save to GitHub and simulate
  </h2>

  {#if draft && source}
    <div class="flex items-center justify-between gap-3 text-sm my-3">
      <p class="text-heading">
        <code>{source.path}</code> on {source.ref ?? "the default branch"}:
        <span class={draft.status === "same" ? "text-body" : "text-warning"}
          >{draft.label}</span
        >{#if draft.from && draft.status !== "same"}<span class="text-body"
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
    <div class="text-sm text-warning border border-warning/40 rounded p-3 my-3">
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
    <p class="text-xs text-body mb-4">
      Signed in to GitHub as <b>{login}</b> ·
      <button class="underline" onclick={forgetToken}>forget the token</button>
    </p>
  {:else}
    <p class="text-xs text-body mb-4">
      Anyone can see the last simulation; saving needs a GitHub token.
    </p>
  {/if}
  <div
    class="grid grid-cols-[8rem_1fr_auto] gap-x-3 gap-y-2 items-center text-sm text-heading"
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
      onchange={pathChanged}
    />
    <span></span>
  </div>
  <p class="text-xs text-body mt-2" data-testid="gh-plan">
    {simPlanSentence(plan)}{#if planFrom}
      — the runs in <code>{simOwnRequestPath(path.trim())}</code> on {planFrom}.
      Every run is the real robot, turret locked forward, POLLEN only, {SAVE_SEEDS}
      seeds, RED.{:else}
      — biobuzz has no simulation request for this Auto yet, so it runs alone
      (the real robot, turret locked forward, POLLEN only, {SAVE_SEEDS} seeds, RED).
      A mentor curates the partners in biobuzz.{/if}
  </p>
  <datalist id="gh-files">
    {#each ppFiles as f (f)}
      <option value={f}></option>
    {/each}
  </datalist>

  {#if token && login}
    <div class="flex items-center justify-between gap-3 mt-4">
      <p class="text-xs {pathProblem ? 'text-warning' : 'text-body'}">
        {#if pathProblem}
          {pathProblem}.
        {:else}
          {#if viaFastLane}
            Fast lane: one commit on <code>{laneBranch(path.trim())}</code>, in
            a pull request into master that merges itself once its checks pass
            (about 1.5 minutes):
          {:else}
            One commit on <code>{branch}</code>:
          {/if}
          <code>{path}</code>
          {#if isNew}<strong class="text-warning">(a new file)</strong
            >{:else}(updated){/if}, its Java, and the simulation request. GitHub
          then runs {SAVE_SEEDS} seeds {plan.length === 1
            ? "of the Auto alone"
            : `of each of the ${plan.length} runs`}, usually in 1–6 minutes; you
          can keep working meanwhile.
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
    <div class="text-sm text-heading flex flex-col gap-2 mt-3">
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
          <b>Pull requests: Read and write</b>, <b>Actions: Read-only</b>.
        </li>
        <li>Generate it, copy it, and paste it here.</li>
      </ol>
      <p class="text-xs text-body">
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

  {#if pull}
    <p class="mt-3 text-sm text-heading">
      <a class="underline" href={pull.url} target="_blank" rel="noreferrer"
        >Pull request #{pull.number}</a
      >
      is open. Sloth Load this branch and try it on the robot; if it is better than
      master's, a mentor merges it on GitHub, and master is the Auto you run.
    </p>
  {/if}

  {#if blocked.length}
    <div class="mt-4 text-sm text-danger">
      <p class="font-semibold">Not saved:</p>
      <ul class="list-disc ml-5">
        {#each blocked as message, i (i)}<li>{message}</li>{/each}
      </ul>
    </div>
  {/if}

  {#if waiting && commit}
    <div class="mt-5 border-t border-border pt-4 text-sm text-heading">
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
          The run finished ({run.conclusion}); fetching its results…
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

  {#if anyShown}
    <div class="mt-5 border-t border-border pt-4 text-sm text-heading">
      <p class="mb-2">
        {hasResult ? "Simulated" : "Last simulated"}
        <code>{commitPath || path.trim()}</code>: one row per run, the Auto
        alone and with each partner stand-in.
        {#if rows.length > 1}Click a row for its seeds.{/if}
        {#if !hasResult}<br /><span class="text-xs text-body"
            >From before your changes on screen: Save to GitHub to simulate
            them.</span
          >{/if}
      </p>
      <table class="w-full text-xs" data-testid="gh-runs">
        <thead class="text-body text-left">
          <tr>
            <th class="py-1">Run</th>
            <th>Best</th>
            <th>Average</th>
            <th>TIPs at (s)</th>
            <th>LEAVE / PARK</th>
            <th>Simulated</th>
            <th>Log</th>
          </tr>
        </thead>
        <tbody>
          {#each rows as row (row.key)}
            <tr
              class="border-t border-border cursor-pointer hover:bg-white/5 {selectedRow ===
              row
                ? 'bg-white/5'
                : ''}"
              onclick={() => {
                selected = selected === row.key ? null : row.key;
                expanded = null;
              }}
            >
              <td class="py-1 font-semibold">{runLabel(row.run)}</td>
              {#if row.shown === null}
                <td colspan="4" class="text-body"
                  >{waiting ? "simulating…" : "not simulated yet"}</td
                >
                <td></td>
                <td></td>
              {:else}
                {#if row.shown.error}
                  <td colspan="4" class="text-danger">{row.shown.error}</td>
                {:else if row.summary.best}
                  <td><strong>{row.summary.best.points}</strong> pts</td>
                  <td
                    >{row.summary.meanPoints.toFixed(1)} over {row.summary.runs}
                    seeds{#if row.summary.withProblems}<span
                        class="text-warning"
                        >, problems in {row.summary.withProblems}</span
                      >{/if}</td
                  >
                  <td
                    >{row.summary.best.autoTips
                      ? row.summary.best.tipsAt
                          .slice(0, row.summary.best.autoTips)
                          .map(secs)
                          .join(", ")
                      : "none"}</td
                  >
                  <td
                    >{row.summary.best.robots
                      .map((x) => `${yesNo(x.leave)} / ${yesNo(x.park)}`)
                      .join(" · ")}</td
                  >
                {:else}
                  <td colspan="4" class="text-body">no seed ran</td>
                {/if}
                <td class="whitespace-nowrap">
                  <a
                    class="underline"
                    href={commitUrl(row.shown.commit)}
                    target="_blank"
                    rel="noreferrer"
                    onclick={(e) => e.stopPropagation()}
                    ><code>{row.shown.commit.slice(0, 7)}</code></a
                  >
                  on {row.shown.branch}, {when(row.shown.finishedAt)} ·
                  <a
                    class="underline"
                    href={row.shown.runUrl}
                    target="_blank"
                    rel="noreferrer"
                    onclick={(e) => e.stopPropagation()}>run</a
                  >
                </td>
                <td class="whitespace-nowrap">
                  {#each Object.entries(row.shown.logs) as [seed, file] (seed)}
                    {#if Number(seed) === bestSeed(row)}
                      <button
                        class="console-action console-action--accent text-xs"
                        onclick={(e) => {
                          e.stopPropagation();
                          void download(row.shown!, file);
                        }}
                        title={file}>WPILOG (best)</button
                      >
                    {/if}
                  {/each}
                </td>
              {/if}
            </tr>
          {/each}
        </tbody>
      </table>

      {#if selectedRow?.shown}
        {@const shown = selectedRow.shown}
        {@const summary = selectedRow.summary}
        {@const runs = shown.runs ?? []}
        <div class="mt-4 border-t border-border pt-3">
          <p class="mb-2">
            <strong>{runLabel(selectedRow.run)}</strong>:
            <code>{shown.spec ?? shown.auto}</code>
            {#if shown.partner}with <code>{shown.partner}</code>{/if}
            on {shown.design ?? "the usual robot"} ·
            <button class="underline" onclick={() => copyVersionLink(shown)}
              >copy a link to this version</button
            >
          </p>
          {#if shown.error}
            <p class="text-danger mb-2">{shown.error}</p>
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
            <p class="mb-3 text-body">
              Over {summary.runs} seeds: {summary.meanPoints.toFixed(1)} points on
              average.
              {summary.tips
                .map(
                  (tip, i) =>
                    `TIP ${i + 1} in ${tip.count} of ${summary.runs}, at ${secs(tip.meanAt)} s.`,
                )
                .join(" ")}
              LEAVE and PARK: {summary.parked} of {summary.robots} robot runs.
              {#if summary.withProblems}<span class="text-warning"
                  >Problems in {summary.withProblems} of {summary.runs} seeds.</span
                >{/if}
            </p>
            <div class="flex flex-wrap gap-2 mb-3">
              {#each Object.entries(shown.logs) as [seed, file] (seed)}
                <button
                  class="console-action {Number(seed) === bestSeed(selectedRow)
                    ? 'console-action--accent'
                    : ''}"
                  onclick={() => download(shown, file)}
                  title={file}
                  >Download WPILOG ({logLabel(
                    selectedRow,
                    Number(seed),
                  )})</button
                >
              {/each}
            </div>
            <p class="text-xs text-body mb-3">
              Then drag the file onto AdvantageScope's window (or File → Open
              Logs…). A web page cannot open AdvantageScope by itself, so it is
              download, then drag.
            </p>
            <table class="w-full text-xs">
              <thead class="text-body text-left">
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
                    class="border-t border-border cursor-pointer hover:bg-white/5"
                    onclick={() =>
                      (expanded = expanded === r.seed ? null : r.seed)}
                  >
                    <td class="py-1"
                      >{r.seed}{r.seed === bestSeed(selectedRow)
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
                    <td class="text-warning">{runProblems(r).join("; ")}</td>
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
                                class="text-warning">; {p}</span
                              >{/each}
                          </p>
                          <pre
                            class="whitespace-pre-wrap text-body">{robot.timeline.join(
                              "\n",
                            )}</pre>
                        {/each}
                      </td>
                    </tr>
                  {/if}
                {/each}
              </tbody>
            </table>
            <p class="text-xs text-body mt-3">
              ▲ the best seed, ★ the median one: both logs are published. AUTO
              starts 10 s into the log; its Metadata tab names the commit and
              .pp it simulated.
            </p>
            <details class="text-xs text-body mt-3">
              <summary class="cursor-pointer text-heading"
                >Set up AdvantageScope on this laptop (once)</summary
              >
              <ol class="list-decimal ml-5 mt-2 flex flex-col gap-1">
                <li>
                  Install <a
                    class="underline"
                    href="https://github.com/Mechanical-Advantage/AdvantageScope/releases"
                    target="_blank"
                    rel="noreferrer">AdvantageScope</a
                  > (v27 alpha 6 or newer).
                </li>
                <li>
                  <button class="underline" onclick={downloadLayout}
                    >Download the team layout</button
                  >, then in AdvantageScope File → Import Layout… and pick it.
                  It is the same layout as for the robot's real match logs, so a
                  simulated run and a real one look alike.
                </li>
                <li>
                  The team's robot model (optional): in your biobuzz checkout,
                  double-click <code
                    >tools/advantagescope/setup-advantagescope.cmd</code
                  >, then restart AdvantageScope.
                </li>
              </ol>
            </details>
          {/if}
        </div>
      {/if}
    </div>
  {/if}

  <div class="flex justify-end gap-3 mt-5">
    <button onclick={close} class="console-action">Close</button>
  </div>
</Modal>
