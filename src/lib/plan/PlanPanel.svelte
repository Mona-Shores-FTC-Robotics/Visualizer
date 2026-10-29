<script lang="ts">
  /**
   * The Auto as a plan: the good path in TIP chapters, one open at a time, and for a wait that
   * branches, what happens when its tip doesn't come (one miss open at a time). Times change
   * with − / +; the path itself is edited on the field and in the inspector.
   */
  import { useAuto } from "../../state/auto.svelte";
  import { usePlayback } from "../../state/playback.svelte";
  import { parseSelection, selectedCardId, updateAuto } from "../auto/store";
  import { AUTO_LENGTH_S } from "../auto/simulate";
  import {
    NOT_SENSED_YET,
    chapterSeconds,
    ladderOutcomes,
    setLimit,
    type PlanStep,
  } from "./plan";
  import Stepper from "./Stepper.svelte";
  import LadderList from "./LadderList.svelte";
  import { startLadder } from "../ladder/edit";
  import { ladderInfo } from "../ladder/compile";
  import { confirmDialog } from "../dialog";
  import PlanOutcomes from "./PlanOutcomes.svelte";

  interface Props {
    /** Export the Java (blocked with a reason when the Auto has errors). */
    onExport: () => void;
    errorCount: number;
  }

  let { onExport, errorCount }: Props = $props();

  const auto = useAuto();
  const playback = usePlayback();

  let outcomesOpen = $state(false);
  let plan = $derived(auto.plan);
  let chapters = $derived(plan?.chapters ?? []);
  let open = $derived(Math.min(auto.chapter, Math.max(0, chapters.length - 1)));
  let selected = $derived(parseSelection($selectedCardId).cardId);
  let total = $derived(auto.preview?.endTime ?? 0);
  let missStep = $derived(auto.missStep);
  /** Every way the Auto can go: the good path, each miss, and each try of a ladder. */
  let outcomeCount = $derived(
    1 +
      (plan?.branches ?? []).reduce((n, step) => {
        const ladder = auto.auto ? ladderInfo(auto.auto, step.cardId) : null;
        return n + (ladder ? ladderOutcomes(ladder).length : 1);
      }, 0),
  );

  const icon: Record<PlanStep["kind"], string> = {
    drive: "→",
    park: "P",
    shoot: "◎",
    collect: "✿",
    wait: "◆",
    command: "▸",
    rejoin: "↩",
  };

  function detail(step: PlanStep): string {
    if (step.limitS === undefined) return "";
    const until =
      step.sense === "tip"
        ? "until the CELL tips"
        : step.sense === "full"
          ? "until full"
          : step.sense === "empty"
            ? "until empty"
            : step.condition
              ? `until ${step.condition}`
              : "";
    const notYet =
      step.condition && NOT_SENSED_YET.includes(step.condition)
        ? " · timed on the robot for now"
        : "";
    return `${until}${until ? ", " : ""}up to ${step.limitS} s${notYet}`;
  }

  const seconds = (step: PlanStep) => {
    const t = auto.times.get(step.cardId);
    return t ? `${(t.t1 - t.t0).toFixed(1)} s` : "";
  };

  function select(step: PlanStep) {
    selectedCardId.set(selected === step.cardId ? null : step.cardId);
  }

  function setTime(step: PlanStep, value: number) {
    updateAuto((draft) => setLimit(draft, step.cardId, value), false);
  }

  function openChapter(index: number) {
    auto.chapter = index;
    const first = chapters[index]?.steps
      .map((step) => auto.times.get(step.cardId)?.t0)
      .find((t) => t !== undefined);
    if (first !== undefined && total > 0) playback.seek((first / total) * 100);
  }

  /** A miss drawn by hand becomes a ladder (empty: park) once the student says so. */
  async function replaceWithTries(step: PlanStep) {
    const ok = await confirmDialog({
      title: "Replace this route with tries?",
      message: `The ${step.miss?.length ?? 0} steps drawn for when ${step.tip ?? "the tip"} doesn't come are replaced by a ladder: tries you pick from the list, then park. Undo brings them back.`,
      confirmLabel: "Replace",
    });
    if (ok) updateAuto((d) => void startLadder(d, step.cardId));
  }

  /** Close the miss and open the plan where it goes back to, with that step selected. */
  function backTo(step: PlanStep) {
    auto.closeMiss();
    const index = chapters.findIndex((chapter) =>
      chapter.steps.some((s) => s.cardId === step.cardId),
    );
    if (index >= 0) openChapter(index);
    selectedCardId.set(step.cardId);
  }

  const now = (step: PlanStep) => {
    const t = auto.times.get(step.cardId);
    return Boolean(
      t &&
      playback.seconds > 0 &&
      playback.seconds >= t.t0 &&
      playback.seconds < t.t1,
    );
  };
</script>

{#snippet stepRow(step: PlanStep, editable: boolean)}
  <li>
    <button
      type="button"
      class={[
        "grid w-full grid-cols-[22px_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition",
        selected === step.cardId
          ? "border-primary bg-base"
          : "border-transparent hover:bg-body/10",
        now(step) && "shadow-[inset_3px_0_0_var(--color-success)]",
      ]}
      onclick={() => select(step)}
    >
      <span
        class={[
          "grid size-[22px] place-items-center rounded-md bg-base text-xs font-bold",
          step.kind === "shoot" && "text-primary",
          step.kind === "collect" && "text-warning",
          step.miss && "text-warning",
          !["shoot", "collect"].includes(step.kind) &&
            !step.miss &&
            "text-body",
        ]}
        aria-hidden="true">{icon[step.kind]}</span
      >
      <span class="min-w-0">
        <span class="block truncate text-sm text-heading">{step.label}</span>
        {#if detail(step) || step.miss}
          <span class="block text-[11px] text-body">
            {detail(step)}
            {#if step.miss}
              <span
                class="ml-1 rounded-full border border-warning px-1.5 text-warning"
                >if it doesn't come: {step.miss.length} steps</span
              >
            {/if}
          </span>
        {/if}
      </span>
      <span class="font-mono text-xs text-body tabular-nums"
        >{seconds(step)}</span
      >
    </button>
    {#if editable && selected === step.cardId}
      <div
        class="mt-1 mb-1 ml-7 flex flex-col gap-2 rounded-lg border border-border bg-base/60 p-2 text-xs text-body"
      >
        {#if step.limitS !== undefined}
          <div class="flex flex-wrap items-center gap-2">
            {step.kind === "shoot"
              ? "Shoot for at most"
              : step.kind === "collect"
                ? "Collect for at most"
                : "Wait at most"}
            <Stepper
              value={step.limitS}
              label={`${step.label}: time limit`}
              onChange={(v) => setTime(step, v)}
            />
          </div>
        {:else if step.lineId}
          <div>
            Drag its points on the field; the inspector edits its heading.
          </div>
        {:else}
          <div>A robot command; it takes as long as the robot's list says.</div>
        {/if}
        {#if (step.miss || (step.sense === "tip" && step.tip)) && !missStep}
          <button
            type="button"
            class="self-start rounded-lg border border-warning px-2 py-1 font-medium text-heading hover:bg-warning/10"
            onclick={() => auto.openMiss(step)}
            >What if {step.tip ?? "it"} doesn't come? →</button
          >
        {/if}
      </div>
    {/if}
  </li>
{/snippet}

<section class="flex min-h-0 flex-1 flex-col gap-3" aria-label="The Auto">
  <div class="flex items-baseline justify-between px-1">
    <span
      class={[
        "font-mono text-xl font-semibold tabular-nums",
        total > AUTO_LENGTH_S ? "text-danger" : "text-heading",
      ]}>{total.toFixed(1)} s</span
    >
    <span class="text-xs text-body">of {AUTO_LENGTH_S} s</span>
  </div>

  {#if missStep}
    <div
      class="flex min-h-0 flex-1 flex-col gap-2 rounded-xl border border-warning/50 bg-base/60 p-3"
    >
      <div class="flex items-center gap-2">
        <h3 class="flex-1 text-sm font-semibold text-warning">
          ◆ If {missStep.tip ?? missStep.label} doesn't come
        </h3>
        <button
          type="button"
          class="rounded-lg border border-border px-2 py-0.5 text-xs text-heading hover:bg-body/10"
          aria-label="Close: back to the good path"
          onclick={() => auto.closeMiss()}>Close</button
        >
      </div>
      {#if missStep.limitS !== undefined}
        <div class="flex flex-wrap items-center gap-2 text-xs text-body">
          Wait for it at most
          <Stepper
            value={missStep.limitS}
            label={`${missStep.label}: time limit`}
            min={1}
            onChange={(v) => setTime(missStep!, v)}
          />
        </div>
      {/if}
      {#if auto.missLadder || !missStep.miss?.length}
        <div class="text-xs text-body">
          {auto.missLadder
            ? "Then, in order (the first that works goes back to the plan):"
            : "Then the robot carries on with the plan. To try something first:"}
        </div>
        <div class="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
          <LadderList waitId={missStep.cardId} ladder={auto.missLadder} />
        </div>
      {:else}
        <div class="text-xs text-body">Then:</div>
        <ul class="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
          {#each missStep.miss ?? [] as step (step.cardId)}
            {@render stepRow(step, true)}
          {/each}
          {#if missStep.then}
            {@const then = missStep.then}
            <li>
              <button
                type="button"
                class="grid w-full grid-cols-[22px_minmax(0,1fr)] items-center gap-2 rounded-lg border border-dashed border-border px-2 py-1.5 text-left hover:bg-body/10"
                title="Close this and show that step on the plan"
                onclick={() => backTo(then)}
              >
                <span
                  class="grid size-[22px] place-items-center rounded-md bg-base text-xs font-bold text-success"
                  aria-hidden="true">↩</span
                >
                <span class="min-w-0 text-sm text-heading"
                  >Back to the plan at <b class="font-semibold">{then.label}</b
                  ></span
                >
              </button>
            </li>
          {/if}
        </ul>
        <button
          type="button"
          class="self-start rounded-lg border border-warning px-2 py-1 text-xs font-medium text-heading hover:bg-warning/10"
          onclick={() => replaceWithTries(missStep!)}
          >Replace with tries…</button
        >
      {/if}
      <p class="text-[11px] text-body">
        The field and the playback show this route. If time runs short, the
        robot's endgame guard parks it.
      </p>
    </div>
  {:else}
    <nav class="flex flex-wrap items-center gap-1" aria-label="Chapters">
      {#each chapters as chapter, i (chapter.name + i)}
        {#if i > 0}<span class="text-[11px] text-body" aria-hidden="true"
            >→</span
          >{/if}
        <button
          type="button"
          class={[
            "rounded-lg border px-2 py-1 text-left leading-tight",
            i === open
              ? "border-success bg-base"
              : "border-border hover:bg-body/10",
          ]}
          aria-current={i === open ? "step" : undefined}
          onclick={() => openChapter(i)}
        >
          <span class="block text-xs font-semibold text-heading"
            >{chapter.name}</span
          >
          <span class="block font-mono text-[10px] text-body tabular-nums"
            >{chapterSeconds(chapter, auto.times).toFixed(1)} s</span
          >
        </button>
      {/each}
    </nav>

    <ul class="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
      {#each chapters[open]?.steps ?? [] as step (step.cardId)}
        {@render stepRow(step, true)}
      {/each}
    </ul>

    {#if open < chapters.length - 1}
      <button
        type="button"
        class="rounded-lg border border-border bg-base px-3 py-1.5 text-sm font-medium text-heading hover:bg-body/10"
        onclick={() => openChapter(open + 1)}
        >Next: {chapters[open + 1].name} →</button
      >
    {/if}
  {/if}

  <div class="flex flex-wrap items-center gap-2 border-t border-border pt-2">
    <button
      type="button"
      class="rounded-lg border border-border px-2 py-1 text-xs text-heading hover:bg-body/10"
      onclick={() => (outcomesOpen = true)}
      >All outcomes ({outcomeCount})</button
    >
    <button
      type="button"
      class="rounded-lg border border-border px-2 py-1 text-xs text-heading hover:bg-body/10"
      title={errorCount
        ? `${errorCount} problem${errorCount === 1 ? "" : "s"} to fix first (see Cards)`
        : "Download the Java for the robot"}
      onclick={onExport}
      >{errorCount ? `Export · ${errorCount} !` : "Export Java"}</button
    >
    <button
      type="button"
      class="ml-auto text-xs text-body underline-offset-2 hover:underline"
      onclick={() => (auto.view = "cards")}>Edit as cards</button
    >
  </div>
</section>

<PlanOutcomes bind:isOpen={outcomesOpen} />
