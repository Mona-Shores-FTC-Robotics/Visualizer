<script lang="ts">
  import {
    entryLogs,
    partnerWords,
    tallyEntry,
    type SimEntry,
    type SimResult,
  } from "./biobuzz";

  interface Props {
    result: SimResult;
    /** Downloads one of the entry's published logs. */
    onDownload: (entry: SimEntry, file: string) => void;
  }

  let { result, onDownload }: Props = $props();

  /** The entry whose seeds are open (its index). */
  let open = $state<number | null>(null);

  const secs = (t: number) => t.toFixed(1);

  let table = $derived(
    (result.entries ?? []).map((entry) => {
      const rows = entry.rows ?? [];
      return {
        entry,
        rows,
        tally: tallyEntry(rows),
        logs: entryLogs(result, entry),
        partnered: entry.partner !== null && entry.partner !== undefined,
      };
    }),
  );

  /** "fired 7, timed out 3 of 10, 4.2 s": how the first wait ended, with the mean seconds waited. */
  function waitWords(t: ReturnType<typeof tallyEntry>): string {
    if (t.waitFired + t.waitTimedOut === 0) return "no wait";
    const parts: string[] = [];
    if (t.waitFired) parts.push(`fired ${t.waitFired}`);
    if (t.waitTimedOut) parts.push(`timed out ${t.waitTimedOut}`);
    const after = t.meanWaitAfter === null ? "" : `, ${secs(t.meanWaitAfter)} s`;
    return `${parts.join(", ")} of ${t.runs}${after}`;
  }

  function logLabel(seed: number, best: number | null, typical: number | null) {
    const isBest = seed === best;
    const isTypical = seed === typical;
    return isBest && isTypical
      ? "best and typical"
      : isBest
        ? "best"
        : isTypical
          ? "typical"
          : "seed";
  }
</script>

<table class="w-full text-xs" data-testid="gh-entries">
  <thead class="text-body text-left">
    <tr>
      <th class="py-1">Run</th>
      <th>Mean points</th>
      <th>TIPs</th>
      <th>Wait</th>
      <th>Collisions</th>
      <th>Parked</th>
      <th>Logs</th>
    </tr>
  </thead>
  <tbody>
    {#each table as row, i (i)}
      {@const t = row.tally}
      <tr
        class="border-t border-border cursor-pointer hover:bg-white/5 {open === i
          ? 'bg-white/5'
          : ''}"
        data-testid="gh-entry"
        onclick={() => (open = open === i ? null : i)}
      >
        <td class="py-1 font-semibold">
          {row.entry.name}
          {#if row.entry.partner}<span class="block font-normal text-body"
              >{partnerWords(row.entry.partner)}</span
            >{/if}
        </td>
        {#if row.entry.error}
          <td colspan="5" class="text-danger">{row.entry.error}</td>
        {:else if t.runs === 0}
          <td colspan="5" class="text-body">no seed ran</td>
        {:else}
          <td
            ><strong>{t.meanPoints.toFixed(1)}</strong>
            <span class="text-body">({t.minPoints}–{t.maxPoints})</span></td
          >
          <td
            >{t.tips.length
              ? t.tips
                  .map(
                    (tip, k) =>
                      `${k + 1}: ${tip.count}/${t.runs} at ${secs(tip.meanAt)} s`,
                  )
                  .join(", ")
              : "none"}</td
          >
          <td>{waitWords(t)}</td>
          <td class={t.collisions ? "text-warning" : ""}
            >{t.collisions
              ? `${t.collisions} of ${t.runs}, first at ${secs(t.firstCollisionAt ?? 0)} s`
              : row.partnered
                ? "none"
                : "—"}</td
          >
          <td
            >{t.parked}/{t.runs}{#if row.partnered}<span class="text-body">
                · partner {t.partnerParked}/{t.runs}</span
              >{/if}</td
          >
        {/if}
        <td class="whitespace-nowrap">
          {#each Object.entries(row.logs.logs) as [seed, file] (seed)}
            <button
              class="console-action text-xs {Number(seed) === row.logs.best
                ? 'console-action--accent'
                : ''}"
              title={file}
              onclick={(e) => {
                e.stopPropagation();
                onDownload(row.entry, file);
              }}
              >{logLabel(Number(seed), row.logs.best, row.logs.typical)}
              {seed}</button
            >
          {/each}
        </td>
      </tr>
      {#if open === i}
        <tr>
          <td colspan="7" class="pb-2">
            <table class="w-full text-xs mt-1" data-testid="gh-entry-seeds">
              <thead class="text-body text-left">
                <tr>
                  <th class="py-1">Seed</th>
                  <th>Points</th>
                  <th>Launched{row.partnered ? " (partner)" : ""}</th>
                  <th>TIPs at (s)</th>
                  <th>Wait</th>
                  <th>Collided at</th>
                  <th>Parked</th>
                </tr>
              </thead>
              <tbody>
                {#each row.rows as r (r.seed)}
                  <tr class="border-t border-border">
                    <td class="py-1"
                      >{r.seed}{r.seed === row.logs.best
                        ? " ▲"
                        : ""}{r.seed === row.logs.typical ? " ★" : ""}</td
                    >
                    <td>{r.points}</td>
                    <td
                      >{r.launched}{r.partnerLaunched !== null &&
                      r.partnerLaunched !== undefined
                        ? ` (${r.partnerLaunched})`
                        : ""}</td
                    >
                    <td
                      >{r.tipsAt.length
                        ? r.tipsAt.map(secs).join(", ")
                        : "none"}</td
                    >
                    <td
                      >{#if r.wait}{r.wait.label}: {r.wait.outcome ??
                          "still waiting"}{#if r.wait.after !== null}
                          after {secs(r.wait.after)} s{/if}{:else}—{/if}</td
                    >
                    <td
                      class={r.robotsCollidedAt !== null &&
                      r.robotsCollidedAt !== undefined
                        ? "text-warning"
                        : ""}
                      >{r.robotsCollidedAt !== null &&
                      r.robotsCollidedAt !== undefined
                        ? `${secs(r.robotsCollidedAt)} s`
                        : "no"}</td
                    >
                    <td
                      >{r.parked ? "yes" : "no"}{r.partnerParked === null ||
                      r.partnerParked === undefined
                        ? ""
                        : ` · partner ${r.partnerParked ? "yes" : "no"}`}</td
                    >
                  </tr>
                {/each}
              </tbody>
            </table>
            <p class="text-xs text-body mt-1">
              ▲ the best seed, ★ the median one: both logs are published.
              {#if row.entry.timing}Partner timing: <code
                  >{JSON.stringify(row.entry.timing)}</code
                >.{/if}
            </p>
          </td>
        </tr>
      {/if}
    {/each}
  </tbody>
</table>
<p class="text-xs text-body mt-2">
  Then drag a downloaded log onto AdvantageScope's window (or File → Open Logs…).
</p>
