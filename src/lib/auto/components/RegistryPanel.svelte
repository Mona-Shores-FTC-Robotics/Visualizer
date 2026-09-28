<script lang="ts">
  import type { AutoSection, NamedPoint } from "../types";
  import { usedNames } from "../tree";
  import { commitAuto, updateAuto } from "../store";
  import { ACTION_CLASS, CELL_CLASS, FIELD_CLASS, LABEL_CLASS, SECTION_CLASS } from "./ui";

  interface Props {
    auto: AutoSection;
    defaultExportName: string;
    /** Where the robot is now; "Add at robot" puts a new point there. */
    robotAt: { x: number; y: number };
  }

  let { auto, defaultExportName, robotAt }: Props = $props();

  let open = $state(true);
  let used = $derived(usedNames(auto));
  let newAction = $state("");
  let newCondition = $state("");
  let newPoint = $state("");
  let unregistered = $derived({
    actions: [...used.actions.keys()].filter((name) => name && !auto.registry.actions.includes(name)),
    conditions: [...used.conditions.keys()].filter((name) => name && !auto.registry.conditions.includes(name)),
  });

  function register(list: "actions" | "conditions", raw: string) {
    const name = raw.trim();
    if (!name) return;
    updateAuto((draft) => {
      if (!draft.registry[list].includes(name)) draft.registry[list].push(name);
    });
  }

  function unregister(list: "actions" | "conditions", name: string) {
    updateAuto((draft) => {
      draft.registry[list] = draft.registry[list].filter((entry) => entry !== name);
    });
  }

  function addPoint() {
    const name = newPoint.trim();
    if (!name || auto.points[name]) return;
    updateAuto((draft) => {
      draft.points[name] = [
        Math.round(robotAt.x * 10) / 10,
        Math.round(robotAt.y * 10) / 10,
      ];
    });
    newPoint = "";
  }

  function setPoint(name: string, index: 0 | 1 | 2, raw: string) {
    const value = Number(raw);
    updateAuto((draft) => {
      const point = [...(draft.points[name] ?? [0, 0])] as number[];
      if (index === 2 && raw.trim() === "") {
        draft.points[name] = [point[0], point[1]];
        return;
      }
      if (!Number.isFinite(value)) return;
      point[index] = value;
      draft.points[name] = (point.length >= 3 ? point.slice(0, 3) : point) as NamedPoint;
    }, false);
  }
</script>

{#snippet nameList(list: "actions" | "conditions", title: string)}
  {@const counts = list === "actions" ? used.actions : used.conditions}
  <div class={CELL_CLASS}>
    <span class={LABEL_CLASS}>{title}</span>
    <div class="space-y-0.5">
      {#each auto.registry[list] as name (name)}
        <div class="flex items-center justify-between gap-2">
          <span class="font-mono text-gray-100">{name}</span>
          <span class="flex items-center gap-2">
            <span class="text-gray-500">{counts.get(name) ? `used ${counts.get(name)}×` : "unused"}</span>
            <button type="button" class="text-gray-500 hover:text-red-400" aria-label={`Remove ${name}`} title="Remove from the registry" onclick={() => unregister(list, name)}>✕</button>
          </span>
        </div>
      {/each}
      {#if auto.registry[list].length === 0}
        <div class="text-gray-500">None yet.</div>
      {/if}
    </div>
    <form
      class="mt-1.5 flex gap-1.5"
      onsubmit={(e) => {
        e.preventDefault();
        if (list === "actions") {
          register("actions", newAction);
          newAction = "";
        } else {
          register("conditions", newCondition);
          newCondition = "";
        }
      }}
    >
      {#if list === "actions"}
        <input class={FIELD_CLASS} placeholder="ShootAll" bind:value={newAction} aria-label="New action name" />
      {:else}
        <input class={FIELD_CLASS} placeholder="LauncherReady" bind:value={newCondition} aria-label="New condition name" />
      {/if}
      <button type="submit" class="{ACTION_CLASS} shrink-0 text-[10px]">Add</button>
    </form>
  </div>
{/snippet}

<div class={SECTION_CLASS}>
  <button type="button" class="flex w-full items-center justify-between gap-2 text-left" onclick={() => (open = !open)} aria-expanded={open}>
    <span>
      <span class="block font-semibold text-gray-100">Robot actions &amp; conditions</span>
      <span class="text-[11px] text-gray-500">
        The names the robot code registers. The editor cannot read robot code: keep this list in step with it.
      </span>
    </span>
    <span class="text-[11px] text-gray-400">{open ? "Hide" : "Show"}</span>
  </button>

  {#if open}
    {#if unregistered.actions.length || unregistered.conditions.length}
      <div class="border border-red-700 bg-red-950 px-2 py-1.5 text-[11px] text-red-300">
        <div class="font-semibold">Used but not registered (blocks the Java export)</div>
        <div class="mt-1 flex flex-wrap gap-1.5">
          {#each unregistered.actions as name (name)}
            <button type="button" class="{ACTION_CLASS} text-[10px]" onclick={() => register("actions", name)}>Register action {name}</button>
          {/each}
          {#each unregistered.conditions as name (name)}
            <button type="button" class="{ACTION_CLASS} text-[10px]" onclick={() => register("conditions", name)}>Register condition {name}</button>
          {/each}
        </div>
      </div>
    {/if}
    <div class="grid gap-2 text-[11px] text-gray-300 lg:grid-cols-2">
      {@render nameList("actions", "Actions")}
      {@render nameList("conditions", "Conditions")}
    </div>

    <div class="grid grid-cols-2 gap-2 text-[11px] text-gray-300">
      <div class={CELL_CLASS}>
        <label class={LABEL_CLASS} for="auto-drawn-for">Drawn for</label>
        <select id="auto-drawn-for" class={FIELD_CLASS} value={auto.drawnFor}
          onchange={(e) => updateAuto((draft) => { draft.drawnFor = e.currentTarget.value === "RED" ? "RED" : "BLUE"; })}>
          <option value="BLUE">BLUE (the robot mirrors it for RED)</option>
          <option value="RED">RED (the robot mirrors it for BLUE)</option>
        </select>
      </div>
      <div class={CELL_CLASS}>
        <label class={LABEL_CLASS} for="auto-export-name">Export name</label>
        <input id="auto-export-name" class={FIELD_CLASS} value={auto.exportName ?? ""} placeholder={defaultExportName}
          oninput={(e) => updateAuto((draft) => { const v = e.currentTarget.value.trim(); if (v) draft.exportName = v; else delete draft.exportName; }, false)}
          onchange={commitAuto} />
      </div>
    </div>

    <div class="{CELL_CLASS} text-[11px] text-gray-300">
      <span class={LABEL_CLASS}>Named points</span>
      <div class="space-y-1">
        {#each Object.entries(auto.points) as [name, point] (name)}
          <div class="grid grid-cols-[minmax(0,1.3fr)_repeat(3,minmax(0,1fr))_auto] items-center gap-1">
            <span class="truncate font-mono text-gray-100" title={name}>{name}</span>
            <input class={FIELD_CLASS} type="number" step="0.5" value={point[0]} aria-label={`${name} x`} oninput={(e) => setPoint(name, 0, e.currentTarget.value)} onchange={commitAuto} />
            <input class={FIELD_CLASS} type="number" step="0.5" value={point[1]} aria-label={`${name} y`} oninput={(e) => setPoint(name, 1, e.currentTarget.value)} onchange={commitAuto} />
            <input class={FIELD_CLASS} type="number" step="5" value={point[2] ?? ""} placeholder="0°" aria-label={`${name} heading`} oninput={(e) => setPoint(name, 2, e.currentTarget.value)} onchange={commitAuto} />
            <button type="button" class="text-gray-500 hover:text-red-400" aria-label={`Remove point ${name}`}
              onclick={() => updateAuto((draft) => { delete draft.points[name]; })}>✕</button>
          </div>
        {/each}
        {#if Object.keys(auto.points).length === 0}
          <div class="text-gray-500">None yet. A path endpoint on a named point is exported under its name.</div>
        {/if}
      </div>
      <form class="mt-1.5 flex gap-1.5" onsubmit={(e) => { e.preventDefault(); addPoint(); }}>
        <input class={FIELD_CLASS} placeholder="ShootSpot" bind:value={newPoint} aria-label="New point name" />
        <button type="submit" class="{ACTION_CLASS} shrink-0 text-[10px]" title="Adds the point where the robot is now">Add at robot</button>
      </form>
    </div>
  {/if}
</div>
