<script lang="ts">
  /**
   * Fork: above the field, what the preview shows: an answer per trigger the
   * Auto waits on, the timing model, and whether to draw the other branches. Not in the Match view
   * with two Autos (FieldPanel): its questions are in the left panel (MatchSide).
   */
  import { partnerTipAt, previewScenario } from "../lib/auto/store";
  import { previewQuestions } from "../lib/auto/simulate";
  import { TIP_CONDITIONS } from "../lib/timing/model";
  import TimingControl from "../lib/timing/TimingControl.svelte";
  import { checkboxClass, labelClass } from "../lib/components/ui/styles";
  import { useProject } from "../state/project.svelte";
  import { useAuto } from "../state/auto.svelte";
  import type { Overlays } from "../state/overlays.svelte";

  interface Props {
    overlays: Overlays;
  }

  let { overlays }: Props = $props();

  const project = useProject();
  const auto = useAuto();

  /** Fork: whether the Auto alone waits on a TIP or a CELL, so the partner's TIP matters. */
  let waitsOnTip = $derived(
    !!auto.auto &&
      previewQuestions(auto.auto).some((q) =>
        TIP_CONDITIONS.includes(q.condition),
      ),
  );
  let tipRule = $derived.by(() => {
    const v = auto.hive?.values;
    const start = Math.max(0, v?.tipStartS ?? 0),
      swing = Math.max(0, v?.tipSwingS ?? 0);
    return `Previewed alone, nothing models the partner's Auto. auto: a wait for a TIP or a CELL gets the partner's TIP one HIVE swing after it starts: when the wait starts + tipStartS (${start.toFixed(1)} s) + tipSwingS (${swing.toFixed(1)} s), from Timing → Facts. A time: the partner's TIP 1 settles then, and no other is assumed. never: no partner TIP (a wait for one runs to its time limit, like its what-if "no").`;
  });
  let tipMode = $derived(
    typeof $partnerTipAt === "number" ? "at" : $partnerTipAt,
  );
</script>

<div class="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-1">
  <TimingControl
    tips={overlays.active
      ? auto.overlayTogether.tips
      : (auto.together?.tips ?? [])}
    entries={overlays.active
      ? auto.overlayTogether.entries
      : auto.auto
        ? [
            {
              auto: auto.auto,
              startPoint: project.doc.startPoint,
              lines: project.doc.lines,
              settings: { ...auto.settings },
              scenario: $previewScenario,
            },
          ]
        : []}
  />
  {#if !overlays.active && waitsOnTip}
    <label class={[labelClass, "flex items-center gap-1.5"]} title={tipRule}>
      Partner TIP 1 at
      <select
        class="rounded border border-body/20 bg-transparent px-1 py-0.5"
        value={tipMode}
        onchange={(e) => {
          const v = e.currentTarget.value;
          partnerTipAt.set(
            v === "at"
              ? Math.round(
                  (auto.together?.tips.find((t) => t.assumedAt !== undefined)
                    ?.settled ?? 5) * 10,
                ) / 10
              : (v as "auto" | "never"),
          );
        }}
        data-testid="partner-tip-mode"
      >
        <option value="auto">auto (one swing after the wait starts)</option>
        <option value="at">a time</option>
        <option value="never">never</option>
      </select>
      {#if typeof $partnerTipAt === "number"}
        <input
          type="number"
          min="0"
          max="30"
          step="0.1"
          class="w-16 rounded border border-body/20 bg-transparent px-1 py-0.5"
          value={$partnerTipAt}
          onchange={(e) => {
            const n = Number(e.currentTarget.value);
            if (Number.isFinite(n) && n >= 0) partnerTipAt.set(n);
          }}
          data-testid="partner-tip-at"
        /> s
      {/if}
    </label>
  {/if}
  {#if overlays.active}
    <label
      class={[labelClass, "flex items-center gap-1.5"]}
      title="Draw the branches these Autos do not take in this preview, faint"
    >
      <input
        type="checkbox"
        class={checkboxClass}
        bind:checked={auto.overlayUntaken}
      />
      Other branches
    </label>
    {#if auto.overlayTogether.shown.length >= 2}
      <label
        class={[labelClass, "flex items-center gap-1.5"]}
        title="Under the field: what each Auto does when, the HIVE between them, and which volley's TIP ends which wait"
      >
        <input
          type="checkbox"
          class={checkboxClass}
          bind:checked={auto.matchTimeline}
        />
        Match timeline
      </label>
      {#if auto.matchTimeline}
        <label
          class={[labelClass, "flex items-center gap-1.5"]}
          title="Under the timeline: change each robot's facts, the HIVE's, which triggers come and who is a no-show, for this look only"
        >
          <input
            type="checkbox"
            class={checkboxClass}
            bind:checked={auto.matchControls}
          />
          What-ifs{auto.match.changed ? " •" : ""}
        </label>
      {/if}
    {/if}
  {/if}
  {#if !overlays.active}<span
      class={[labelClass, "ml-auto whitespace-nowrap"]}
      title="Hold Shift while dragging a path point to keep it level or plumb with the previous point, so the path runs exactly along x or y"
    >
      Shift-drag: straight x/y
    </span>{/if}
</div>
