<script lang="ts">
  import type { Settings } from "../../../types";
  import type { AutoSection, RoutineDef, RoutineStep } from "../types";
  import { allCards } from "../tree";
  import { commitAuto, updateAuto } from "../store";
  import { motionAlong, placeRoutine, segmentSamples } from "../motion";
  import { ACTION_CLASS, CELL_CLASS, FIELD_CLASS, LABEL_CLASS, seconds } from "./ui";

  interface Props {
    auto: AutoSection;
    name: string;
    settings: Settings;
  }

  let { auto, name, settings }: Props = $props();

  let routine: RoutineDef | undefined = $derived(auto.routines[name]);
  let usedBy = $derived(allCards(auto.cards).filter((card) => card.kind === "routine" && card.routine === name).length);
  let snap = $state(true);
  let svg = $state<SVGSVGElement>();
  let dragging: { step: number; control: boolean } | null = $state(null);

  // Pattern space: forward is up the screen, left is to the left.
  const origin = { x: 0, y: 0, facingDeg: 90, mirror: false };
  let samples = $derived(routine ? segmentSamples(placeRoutine(routine, origin), { x: 0, y: 0 }) : []);
  let motion = $derived(motionAlong(samples, settings, 0));
  let bounds = $derived.by(() => {
    const xs = [0, ...samples.map((p) => p.x)];
    const ys = [0, ...samples.map((p) => p.y)];
    routine?.steps.forEach((step) => {
      if (step.control) {
        xs.push(-step.control[1]);
        ys.push(step.control[0]);
      }
    });
    const pad = 12;
    const minX = Math.min(...xs) - pad;
    const maxX = Math.max(...xs) + pad;
    const minY = Math.min(...ys) - pad;
    const maxY = Math.max(...ys) + pad;
    const size = Math.max(maxX - minX, maxY - minY, 36);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    return { x: cx - size / 2, y: -(cy + size / 2), size };
  });
  let gridLines = $derived.by(() => {
    const lines: { v: number; major: boolean }[] = [];
    const from = Math.floor(Math.min(bounds.x, bounds.y) / 3) * 3 - 3;
    const to = Math.max(bounds.x, bounds.y) + bounds.size + 3;
    for (let v = from; v <= to; v += 3) lines.push({ v, major: v % 12 === 0 });
    return lines;
  });

  const sx = (left: number) => -left;
  const sy = (forward: number) => -forward;

  function edit(mutate: (routine: RoutineDef) => void, record = true) {
    updateAuto((draft) => {
      const target = draft.routines[name];
      if (target) mutate(target);
    }, record);
  }

  function setStep(index: number, change: Partial<RoutineStep>, record = true) {
    edit((r) => {
      r.steps[index] = { ...r.steps[index], ...change };
      if (change.control === undefined && "control" in change) delete r.steps[index].control;
    }, record);
  }

  function toPattern(event: PointerEvent): [number, number] {
    if (!svg) return [0, 0];
    const box = svg.getBoundingClientRect();
    const x = bounds.x + ((event.clientX - box.left) / box.width) * bounds.size;
    const y = bounds.y + ((event.clientY - box.top) / box.height) * bounds.size;
    let forward = -y;
    let left = -x;
    if (snap) {
      forward = Math.round(forward);
      left = Math.round(left);
    } else {
      forward = Math.round(forward * 10) / 10;
      left = Math.round(left * 10) / 10;
    }
    return [forward, left];
  }

  function beginDrag(step: number, control: boolean, event: PointerEvent) {
    event.preventDefault();
    dragging = { step, control };
    const move = (e: PointerEvent) => {
      const [forward, left] = toPattern(e);
      if (control) setStep(step, { control: [forward, left] }, false);
      else setStep(step, { forward, left }, false);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      dragging = null;
      commitAuto();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  function rename(next: string) {
    const trimmed = next.trim();
    if (!trimmed || trimmed === name || auto.routines[trimmed]) return;
    updateAuto((draft) => {
      draft.routines[trimmed] = draft.routines[name];
      delete draft.routines[name];
      for (const card of allCards(draft.cards)) {
        if (card.kind === "routine" && card.routine === name) card.routine = trimmed;
      }
    });
  }

  const numberOr = (value: string, fallback: number) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
</script>

{#snippet chips(names: string[], kind: string, onRemove: (index: number) => void, onAdd: (name: string) => void)}
  {@const options = kind === "condition" ? auto.registry.conditions : auto.registry.actions}
  <div class="flex flex-wrap items-center gap-1.5">
    {#each names as entry, index (entry)}
      <span class="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px]"
        class:border-[#444444]={options.includes(entry)} class:border-red-600={!options.includes(entry)} class:text-red-400={!options.includes(entry)}>
        {entry}
        <button type="button" class="text-gray-500 hover:text-gray-200" aria-label={`Remove ${entry}`} onclick={() => onRemove(index)}>✕</button>
      </span>
    {/each}
    <select class="{FIELD_CLASS} !w-auto" value="" aria-label={`Add ${kind}`}
      onchange={(e) => { const v = e.currentTarget.value; e.currentTarget.value = ""; if (v) onAdd(v); }}>
      <option value="">+ add {kind}…</option>
      {#each options.filter((option) => !names.includes(option)) as option (option)}
        <option value={option}>{option}</option>
      {/each}
    </select>
  </div>
{/snippet}

{#if routine}
  <div class="space-y-2 border border-[#2c4a50] bg-[#10191b] px-2 py-2 text-[11px] text-gray-300">
    <div class="flex items-center justify-between gap-2">
      <div>
        <div class="font-semibold text-[#5fd4e6]">Routine editor</div>
        <div class="text-gray-500">Defined relative to where it starts; used by {usedBy} card{usedBy === 1 ? "" : "s"}. Changes apply to every use.</div>
      </div>
      <label class="flex items-center gap-1.5 text-gray-400"><input type="checkbox" bind:checked={snap} /> Snap to 1 in</label>
    </div>
    <div class="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
      <div class="space-y-2">
        <label class="block space-y-1">
          <span class="text-gray-500">Name</span>
          <input class={FIELD_CLASS} value={name} onchange={(e) => rename(e.currentTarget.value)} aria-label="Routine name" />
        </label>
        <label class="block space-y-1">
          <span class="text-gray-500">Ends when</span>
          <select class={FIELD_CLASS} value={routine.endsWhen} class:!border-red-600={!auto.registry.conditions.includes(routine.endsWhen)}
            onchange={(e) => edit((r) => { r.endsWhen = e.currentTarget.value; })}>
            {#if !auto.registry.conditions.includes(routine.endsWhen)}
              <option value={routine.endsWhen}>{routine.endsWhen || "(choose a condition)"}</option>
            {/if}
            {#each auto.registry.conditions as condition (condition)}
              <option value={condition}>{condition}</option>
            {/each}
          </select>
        </label>
        <label class="block space-y-1">
          <span class="text-gray-500">…or gives up after (ms)</span>
          <input class={FIELD_CLASS} type="number" min="100" step="100" value={routine.timeoutMs}
            oninput={(e) => edit((r) => { const v = numberOr(e.currentTarget.value, r.timeoutMs); if (v > 0) r.timeoutMs = v; }, false)}
            onchange={commitAuto} />
        </label>
        <div class="font-mono text-gray-400">
          pattern {motion.length.toFixed(0)} in · {seconds(motion.seconds)}
        </div>
      </div>
      <div class="rounded border border-[#333333] bg-[#151515] p-1">
        <svg
          bind:this={svg}
          class="block aspect-square w-full touch-none select-none"
          viewBox={`${bounds.x} ${bounds.y} ${bounds.size} ${bounds.size}`}
          role="img"
          aria-label="Routine pattern: drag a point to move it"
        >
          {#each gridLines as line (line.v)}
            <line x1={line.v} y1={bounds.y - 10} x2={line.v} y2={bounds.y + bounds.size + 10} stroke={line.major ? "#343434" : "#1f1f1f"} stroke-width={bounds.size / 400} />
            <line x1={bounds.x - 10} y1={line.v} x2={bounds.x + bounds.size + 10} y2={line.v} stroke={line.major ? "#343434" : "#1f1f1f"} stroke-width={bounds.size / 400} />
          {/each}
          <rect x={-settings.rWidth / 2} y={-settings.rHeight / 2} width={settings.rWidth} height={settings.rHeight}
            fill="#ff6fb5" fill-opacity="0.12" stroke="#ff6fb5" stroke-width={bounds.size / 250} />
          <line x1="0" y1="0" x2="0" y2={-settings.rHeight / 2 - 3} stroke="#ffffff" stroke-width={bounds.size / 250} />
          <polyline points={samples.map((p) => `${p.x},${-p.y}`).join(" ")} fill="none" stroke="#5fd4e6" stroke-width={bounds.size / 140} stroke-linejoin="round" stroke-linecap="round" />
          {#each routine.steps as step, index (index)}
            {#if step.control}
              {@const previous = index === 0 ? { forward: 0, left: 0 } : routine.steps[index - 1]}
              <polyline points={`${sx(previous.left)},${sy(previous.forward)} ${sx(step.control[1])},${sy(step.control[0])} ${sx(step.left)},${sy(step.forward)}`}
                fill="none" stroke="#5fd4e6" stroke-opacity="0.4" stroke-dasharray={`${bounds.size / 120}`} stroke-width={bounds.size / 350} />
              <rect x={sx(step.control[1]) - bounds.size / 70} y={sy(step.control[0]) - bounds.size / 70} width={bounds.size / 35} height={bounds.size / 35}
                fill="#10262a" stroke="#5fd4e6" stroke-width={bounds.size / 300} class="cursor-grab"
                role="button" tabindex="-1" aria-label={`Control point of step ${index + 1}`}
                onpointerdown={(e) => beginDrag(index, true, e)} />
            {/if}
            <circle cx={sx(step.left)} cy={sy(step.forward)} r={bounds.size / 50} fill={dragging?.step === index && !dragging.control ? "#ffffff" : "#5fd4e6"}
              stroke="#111111" stroke-width={bounds.size / 300} class="cursor-grab"
              role="button" tabindex="-1" aria-label={`Step ${index + 1}`}
              onpointerdown={(e) => beginDrag(index, false, e)} />
            <text x={sx(step.left) + bounds.size / 35} y={sy(step.forward) - bounds.size / 50} font-size={bounds.size / 22} fill="#dddddd">{index + 1}</text>
          {/each}
        </svg>
      </div>
    </div>

    <div class="space-y-1">
      <div class="grid grid-cols-[1.2rem_repeat(2,minmax(0,1fr))_auto_repeat(2,minmax(0,1fr))_auto] items-center gap-1 text-gray-500">
        <span>#</span><span>forward</span><span>left</span><span>curve</span><span>ctrl fwd</span><span>ctrl left</span><span></span>
      </div>
      {#each routine.steps as step, index (index)}
        <div class="grid grid-cols-[1.2rem_repeat(2,minmax(0,1fr))_auto_repeat(2,minmax(0,1fr))_auto] items-center gap-1">
          <span class="text-gray-500">{index + 1}</span>
          <input class={FIELD_CLASS} type="number" step="1" value={step.forward} aria-label={`Step ${index + 1} forward`}
            oninput={(e) => setStep(index, { forward: numberOr(e.currentTarget.value, step.forward) }, false)} onchange={commitAuto} />
          <input class={FIELD_CLASS} type="number" step="1" value={step.left} aria-label={`Step ${index + 1} left`}
            oninput={(e) => setStep(index, { left: numberOr(e.currentTarget.value, step.left) }, false)} onchange={commitAuto} />
          <input type="checkbox" checked={!!step.control} aria-label={`Step ${index + 1} is a curve`}
            onchange={(e) => {
              const previous = index === 0 ? { forward: 0, left: 0 } : routine!.steps[index - 1];
              if (e.currentTarget.checked)
                setStep(index, { control: [(previous.forward + step.forward) / 2 + 4, (previous.left + step.left) / 2] });
              else setStep(index, { control: undefined });
            }} />
          {#if step.control}
            <input class={FIELD_CLASS} type="number" step="1" value={step.control[0]} aria-label={`Step ${index + 1} control forward`}
              oninput={(e) => setStep(index, { control: [numberOr(e.currentTarget.value, step.control![0]), step.control![1]] }, false)} onchange={commitAuto} />
            <input class={FIELD_CLASS} type="number" step="1" value={step.control[1]} aria-label={`Step ${index + 1} control left`}
              oninput={(e) => setStep(index, { control: [step.control![0], numberOr(e.currentTarget.value, step.control![1])] }, false)} onchange={commitAuto} />
          {:else}
            <span></span><span></span>
          {/if}
          <button type="button" class="text-gray-500 hover:text-red-400" aria-label={`Delete step ${index + 1}`}
            onclick={() => edit((r) => { r.steps.splice(index, 1); })}>✕</button>
        </div>
      {/each}
      <button type="button" class="{ACTION_CLASS} text-[10px]"
        onclick={() => edit((r) => { const last = r.steps[r.steps.length - 1] ?? { forward: 0, left: 0 }; r.steps.push({ forward: last.forward + 12, left: last.left }); })}>
        + Step
      </button>
    </div>

    <div class="grid gap-2 sm:grid-cols-2">
      <div class={CELL_CLASS}>
        <span class={LABEL_CLASS}>While it runs</span>
        {@render chips(routine.while, "action",
          (index) => edit((r) => { r.while.splice(index, 1); }),
          (value) => edit((r) => { if (!r.while.includes(value)) r.while.push(value); }))}
      </div>
      <div class={CELL_CLASS}>
        <span class={LABEL_CLASS}>On the way out</span>
        {@render chips(routine.exit, "action",
          (index) => edit((r) => { r.exit.splice(index, 1); }),
          (value) => edit((r) => { if (!r.exit.includes(value)) r.exit.push(value); }))}
      </div>
    </div>
  </div>
{/if}
