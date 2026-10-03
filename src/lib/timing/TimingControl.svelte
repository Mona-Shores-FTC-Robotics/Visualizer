<script lang="ts">
  /**
   * The Field header's timing switch: Typical (waits end when they typically would, TIPs from the
   * volleys) or Instant (every ✓ at once), and the dialog that edits the team's timing facts.
   */
  import { onMount } from "svelte";
  import Modal from "../components/ui/Modal.svelte";
  import { showToast } from "../toast";
  import { FACTS, cleanValue, timingFileText, type Tip } from "./model";
  import {
    breakpoints,
    tipsInAuto,
    type Breakpoint,
    type FieldEntry,
  } from "./together";
  import {
    TIMING_FILE,
    loadTeamTiming,
    setOverride,
    teamTiming,
    timingBranch,
    timingMode,
    timingOverrides,
    timingValues,
  } from "./store";

  interface Props {
    /** The TIPs in the preview on screen, for the dialog. */
    tips?: Tip[];
    /** The Autos on screen, for the breakpoint search. */
    entries?: FieldEntry[];
  }
  let { tips = [], entries = [] }: Props = $props();

  let found: Breakpoint[] | null = $state(null);
  let searching = $state(false);
  // A new search is needed whenever the Autos or the values change.
  $effect(() => {
    void entries;
    void $timingValues;
    found = null;
  });

  function findBreakpoints() {
    searching = true;
    // Let the button show "Searching…" before the work blocks the page.
    setTimeout(() => {
      try {
        found = breakpoints(entries, $timingValues);
      } catch (error) {
        showToast(
          `Breakpoint search failed: ${(error as Error).message}`,
          "error",
        );
      }
      searching = false;
    }, 30);
  }

  function describe(b: Breakpoint | undefined): string {
    if (!b || (!b.up && !b.down)) return "no change in range";
    const u = unit(b.id);
    const parts: string[] = [];
    if (b.down)
      parts.push(
        `below ${b.down.value} ${u}: ${b.down.from}→${b.down.to} TIPs`,
      );
    if (b.up)
      parts.push(`above ${b.up.value} ${u}: ${b.up.from}→${b.up.to} TIPs`);
    return parts.join(" · ");
  }

  let open = $state(false);
  let loading = $state(false);

  async function reload() {
    loading = true;
    const error = await loadTeamTiming(timingBranch());
    loading = false;
    if (error) showToast(error, "error");
  }

  onMount(() => {
    reload();
  });

  function onInput(id: string, raw: string) {
    const fact = FACTS.find((f) => f.id === id)!;
    const value = cleanValue(fact, raw);
    if (value !== null) setOverride(id, value);
  }

  async function copyFile() {
    const text = timingFileText($timingValues, $teamTiming?.file ?? null);
    try {
      await navigator.clipboard.writeText(text);
      showToast(
        `Copied: paste it over TeamCode/autos/${TIMING_FILE} in biobuzz and push.`,
        "success",
      );
    } catch {
      window.prompt(`Copy this into TeamCode/autos/${TIMING_FILE}:`, text);
    }
  }

  const unit = (id: string) => FACTS.find((f) => f.id === id)?.unit ?? "s";
  let changed = $derived(Object.keys($timingOverrides).length);
</script>

<div
  class="flex items-center gap-1.5 module-caption"
  title="How long waits take in the preview"
>
  <span>Timing</span>
  <select
    class="console-input px-1 py-0.5 text-xs"
    bind:value={$timingMode}
    title="Typical: each wait ends when it typically would, and TIPs come from the robots' volleys (the team's timing facts). Instant: every ✓ is true the moment it is asked."
  >
    <option value="typical">Typical</option>
    <option value="instant">Instant</option>
  </select>
  <button
    class="console-action text-xs px-1.5 py-0.5"
    onclick={() => (open = true)}
  >
    Facts{changed ? ` (${changed} changed)` : ""}
  </button>
</div>

<Modal
  isOpen={open}
  titleId="timing-title"
  onClose={() => (open = false)}
  panelClass="console-panel console-flat p-6 w-full max-w-3xl mx-4 max-h-[85vh] flex flex-col"
>
  <h2
    id="timing-title"
    class="text-2xl font-semibold text-neutral-900 dark:text-neutral-100 mb-1"
  >
    Timing facts
  </h2>
  <p class="text-sm text-neutral-600 dark:text-neutral-400 mb-3">
    How the robot and the HIVE behave, used by the Typical preview. They
    describe the world, not one Auto: the team's values live in biobuzz <code
      >TeamCode/autos/{TIMING_FILE}</code
    >
    {#if $teamTiming}(read from <code>{$teamTiming.ref}</code>){:else}(none
      found on
      <code>{timingBranch()}</code>: the simulator's values are used){/if}.
    Changes here stay on this laptop until you copy them into that file. TIPs
    come from the volleys: each one lands its weight in the raised CELL, and the
    one that reaches the TIP weight swings the HIVE.
  </p>

  <div class="console-section flex-1 overflow-y-auto mb-3">
    <table class="w-full text-sm">
      <thead>
        <tr class="text-xs uppercase text-neutral-500 text-left">
          <th class="px-3 py-2">Fact</th>
          <th class="px-2 py-2">Value</th>
          <th class="px-2 py-2">Team</th>
          {#if found}<th class="px-2 py-2">Breakpoints</th>{/if}
          <th class="px-2 py-2"></th>
        </tr>
      </thead>
      <tbody>
        {#each FACTS as fact (fact.id)}
          {@const team = $teamTiming?.file.facts[fact.id]}
          {@const mine = $timingOverrides[fact.id]}
          <tr class="border-t border-neutral-200 dark:border-neutral-700">
            <td class="px-3 py-2">
              <div class="text-neutral-900 dark:text-neutral-100">
                {fact.label}
              </div>
              <div class="text-xs text-neutral-500">
                {fact.times}{team?.note ? ` · ${team.note}` : ""}
              </div>
            </td>
            <td class="px-2 py-2 whitespace-nowrap">
              <input
                type="number"
                step={unit(fact.id) === "s" ? 0.1 : 0.5}
                class="console-input w-20 px-1 py-0.5 text-sm {mine !==
                undefined
                  ? 'font-semibold'
                  : ''}"
                value={$timingValues[fact.id]}
                onchange={(e) =>
                  onInput(fact.id, (e.target as HTMLInputElement).value)}
              />
              <span class="text-xs text-neutral-500">{unit(fact.id)}</span>
            </td>
            <td class="px-2 py-2 text-xs text-neutral-500 whitespace-nowrap">
              {team
                ? `${team.value} ${unit(fact.id)} · ${team.source ?? "?"}`
                : `${fact.fallback} · sim`}
            </td>
            {#if found}
              {@const b = found.find((x) => x.id === fact.id)}
              <td
                class="px-2 py-2 text-xs {b?.up || b?.down
                  ? 'text-amber-700 dark:text-amber-400'
                  : 'text-neutral-500'}"
              >
                {describe(b)}
              </td>
            {/if}
            <td class="px-2 py-2">
              {#if mine !== undefined}
                <button
                  class="console-action text-xs px-1.5 py-0.5"
                  onclick={() => setOverride(fact.id, null)}>Undo</button
                >
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  {#if tips.length}
    <p class="text-sm text-neutral-700 dark:text-neutral-300 mb-1">
      TIPs in this preview (settled), {tipsInAuto(tips)} by 30 s:
      {tips
        .map((tip, i) => `TIP ${i + 1} ${tip.settled.toFixed(1)} s`)
        .join(" · ")}
    </p>
  {/if}
  <p class="text-xs text-neutral-500 mb-3">
    Breakpoints: for each fact, the nearest values (others held where they are)
    at which the TIPs by 30 s change for the Autos on screen. A fact with a
    breakpoint close to its value is the one to measure first.
  </p>

  <div class="flex flex-wrap justify-end gap-2">
    <button
      class="console-action"
      onclick={findBreakpoints}
      disabled={searching || entries.length === 0}
      >{searching ? "Searching…" : "Find breakpoints"}</button
    >
    <button class="console-action" onclick={reload} disabled={loading}
      >{loading ? "Loading…" : "Reload team values"}</button
    >
    <button
      class="console-action"
      onclick={() => timingOverrides.set({})}
      disabled={!changed}>Undo all mine</button
    >
    <button class="console-action" onclick={copyFile}>Copy {TIMING_FILE}</button
    >
    <button
      class="console-action console-action--accent"
      onclick={() => (open = false)}>Done</button
    >
  </div>
</Modal>
