<script lang="ts">
  /**
   * A miss's ladder: the tries in order, then park. Each try is a play from the BIOBUZZ list;
   * the rules (back to the plan, a source is used once, park when out of tries) are fixed and
   * applied by the editor (lib/ladder). Pressing Show previews that outcome on the field.
   */
  import { useAuto } from "../../state/auto.svelte";
  import { updateAuto } from "../auto/store";
  import type { LadderInfo, TryInfo } from "../ladder/compile";
  import {
    addTry,
    moveTry,
    playSeconds,
    removeTry,
    setTryTime,
  } from "../ladder/edit";
  import { BIOBUZZ_PLAYS, SOURCE_NAMES } from "../ladder/plays";
  import { ladderOutcomes } from "./plan";
  import Stepper from "./Stepper.svelte";

  interface Props {
    waitId: string;
    ladder: LadderInfo | null;
  }

  let { waitId, ladder }: Props = $props();

  const auto = useAuto();
  let adding = $state(false);

  let tries = $derived(ladder?.tries ?? []);
  let kept = $derived(tries.filter((t) => t.status === "kept"));
  let parkK = $derived(ladder ? ladderOutcomes(ladder).at(-1)!.k : 0);
  let available = $derived(
    BIOBUZZ_PLAYS.filter((play) => !tries.some((t) => t.try.play === play.id)),
  );

  const keptIndex = (t: TryInfo) => kept.indexOf(t);
  const shown = (k: number) => !!ladder && auto.missTry === k;

  function show(k: number) {
    const step = auto.missStep;
    if (step) auto.openMiss(step, k);
  }

  const then = (t: TryInfo): string => {
    if (t.status !== "kept") return t.reason ?? "";
    return t.then?.kind === "parkEarly"
      ? `If it works: the plan until ${SOURCE_NAMES[t.then.before]}, then park`
      : "If it works: back to the plan";
  };

  const btn =
    "grid size-6 place-items-center rounded-md border border-border text-xs text-heading hover:bg-body/10 disabled:opacity-30";
</script>

{#if ladder}
  <ol class="flex flex-col gap-1" aria-label="Tries">
    {#each tries as t (t.try.play)}
      {@const k = keptIndex(t)}
      <li
        class={[
          "rounded-lg border px-2 py-1.5",
          k >= 0 && shown(k) ? "border-warning bg-base" : "border-border",
          t.status !== "kept" && "opacity-60",
        ]}
      >
        <div class="flex items-start gap-2">
          <span
            class="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-warning/20 text-[11px] font-bold text-warning"
            >{t.index + 1}</span
          >
          <span class="min-w-0 flex-1">
            <span class="block text-sm text-heading"
              >{t.play?.name ?? t.try.play}</span
            >
            <span class="block text-[11px] text-body">{then(t)}</span>
          </span>
        </div>
        <div class="mt-1 ml-7 flex items-center gap-1">
          {#if k >= 0}
            <button
              type="button"
              class="rounded-md border border-border px-1.5 py-0.5 text-[11px] text-heading hover:bg-body/10"
              aria-pressed={shown(k)}
              title="Show this route on the field: try {t.index + 1} works"
              onclick={() => show(k)}>{shown(k) ? "Showing" : "Show"}</button
            >
          {/if}
          <span class="flex-1"></span>
          <button
            type="button"
            class={btn}
            aria-label={`Move try ${t.index + 1} up`}
            disabled={t.index === 0}
            onclick={() => updateAuto((d) => moveTry(d, waitId, t.index, -1))}
            >↑</button
          >
          <button
            type="button"
            class={btn}
            aria-label={`Move try ${t.index + 1} down`}
            disabled={t.index === tries.length - 1}
            onclick={() => updateAuto((d) => moveTry(d, waitId, t.index, 1))}
            >↓</button
          >
          <button
            type="button"
            class={btn}
            aria-label={`Remove try ${t.index + 1}`}
            onclick={() => updateAuto((d) => removeTry(d, waitId, t.index))}
            >✕</button
          >
        </div>
        {#if k >= 0 && shown(k) && t.play}
          {@const collect = playSeconds(t.play, "collect")}
          {@const shoot = playSeconds(t.play, "shoot")}
          <div class="mt-1.5 ml-7 flex flex-col gap-1.5 text-xs text-body">
            {#if collect !== null}
              <div class="flex flex-wrap items-center gap-2">
                Collect for at most
                <Stepper
                  value={t.try.collectS ?? collect}
                  label={`Try ${t.index + 1}: collect time`}
                  onChange={(v) =>
                    updateAuto(
                      (d) => setTryTime(d, waitId, t.index, "collectS", v),
                      false,
                    )}
                />
              </div>
            {/if}
            {#if shoot !== null}
              <div class="flex flex-wrap items-center gap-2">
                Wait for the tip at most
                <Stepper
                  value={t.try.shootS ?? shoot}
                  label={`Try ${t.index + 1}: tip wait`}
                  onChange={(v) =>
                    updateAuto(
                      (d) => setTryTime(d, waitId, t.index, "shootS", v),
                      false,
                    )}
                />
              </div>
            {/if}
          </div>
        {/if}
      </li>
    {/each}
    <li
      class={[
        "flex items-center gap-2 rounded-lg border px-2 py-1.5",
        shown(parkK) ? "border-warning bg-base" : "border-dashed border-border",
      ]}
    >
      <span
        class="grid size-5 shrink-0 place-items-center rounded-full bg-body/15 text-[11px] font-bold text-heading"
        >P</span
      >
      <span class="flex-1 text-sm text-heading"
        >{tries.length ? "Then park" : "Park"}</span
      >
      {#if ladder}
        <button
          type="button"
          class="rounded-md border border-border px-1.5 py-0.5 text-[11px] text-heading hover:bg-body/10"
          aria-pressed={shown(parkK)}
          title="Show this route on the field: every try misses"
          onclick={() => show(parkK)}
          >{shown(parkK) ? "Showing" : "Show"}</button
        >
      {/if}
    </li>
  </ol>
{/if}

{#if adding}
  <div
    class="flex flex-col gap-1 rounded-lg border border-border p-2"
    role="group"
    aria-label="Plays"
  >
    <div class="text-xs text-body">Add a try:</div>
    {#each available as play (play.id)}
      <button
        type="button"
        class="rounded-md px-2 py-1 text-left text-sm text-heading hover:bg-body/10"
        onclick={() => {
          updateAuto((d) => addTry(d, waitId, play));
          adding = false;
        }}
        >{play.name}{#if play.source}<span class="text-xs text-body">
            · uses {SOURCE_NAMES[play.source]}</span
          >{/if}</button
      >
    {:else}
      <div class="text-xs text-body">Every play is on this ladder already.</div>
    {/each}
    <button
      type="button"
      class="self-start text-xs text-body underline-offset-2 hover:underline"
      onclick={() => (adding = false)}>Cancel</button
    >
  </div>
{:else}
  <button
    type="button"
    class="self-start rounded-lg border border-warning px-2 py-1 text-xs font-medium text-heading hover:bg-warning/10"
    onclick={() => (adding = true)}>+ Add a try</button
  >
{/if}
