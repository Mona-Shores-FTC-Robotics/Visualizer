<script lang="ts">
  import type { PathCatalog } from "../geometry";
  import type { AutoIssue } from "../validate";
  import type { PreviewResult, WorstCase } from "../simulate";
  import { AUTO_LENGTH_S } from "../simulate";
  import {
    DEFAULT_TIMEOUT_S,
    rowKind,
    type AutoCard,
    type AutoRow,
    type AutoSection,
    type PathEvent,
    type RowKind,
  } from "../types";
  import type { Shape } from "../../../types";
  import { cardTitle, findCard, isPlainWait, listLabel, locateCard, rowLabel } from "../tree";
  import { checkFit, placementAt, placeRoutine, segmentSamples } from "../motion";
  import RoutineEditor from "./RoutineEditor.svelte";
  import { canMove, duplicateCard, moveCard, removeCard, rowOfKind } from "../edit";
  import { commitAuto, parseSelection, selectedCardId, updateAuto } from "../store";
  import EventsBar from "./EventsBar.svelte";
  import {
    ACTION_CLASS,
    CELL_CLASS,
    DANGER_CLASS,
    FIELD_CLASS,
    LABEL_CLASS,
    SECTION_CLASS,
    branchColor,
    seconds,
  } from "./ui";

  interface Props {
    auto: AutoSection;
    catalog: PathCatalog;
    issues: AutoIssue[];
    preview: PreviewResult | null;
    worst: WorstCase | null;
    shapes: Shape[];
  }

  let { auto, catalog, issues, preview, worst, shapes }: Props = $props();

  let selection = $derived(parseSelection($selectedCardId));
  let card: AutoCard | null = $derived(findCard(auto.cards, selection.cardId));
  let cardIssues = $derived(card ? issues.filter((issue) => issue.cardId === card!.id) : []);
  let actions = $derived(auto.registry.actions);
  let conditions = $derived(auto.registry.conditions);
  let pointNames = $derived(Object.keys(auto.points));
  let newEndName = $state("");
  /** Whether a path card shows its rarely used settings (which path, while, events). */
  let showMore = $state(false);

  /** Puts a path's end on a named point ("" takes it off); the end moves to the point. */
  function pinEnd(segmentId: string, name: string) {
    updateAuto((draft) => {
      if (name && draft.points[name]) draft.pathEnds[segmentId] = name;
      else delete draft.pathEnds[segmentId];
    });
  }

  /** Names a path's end where it is (to 0.1 in) and puts the end on it. */
  function nameEnd(segmentId: string, end: { x: number; y: number }, headingDeg: number) {
    const name = newEndName.trim();
    if (!name || auto.points[name]) return;
    const round = (value: number) => Math.round(value * 10) / 10;
    updateAuto((draft) => {
      draft.points[name] = [round(end.x), round(end.y), Math.round(((headingDeg % 360) + 360) % 360)];
      draft.pathEnds[segmentId] = name;
    });
    newEndName = "";
  }

  const ROW_KINDS: { value: RowKind; label: string }[] = [
    { value: "when", label: "Condition is true" },
    { value: "afterMs", label: "Time passed (ms)" },
    { value: "timeLeftBelowS", label: "Time left below (s)" },
    { value: "otherwise", label: "Otherwise (at once)" },
    { value: "nearPoint", label: "Near a point" },
    { value: "inArea", label: "Inside an area" },
  ];

  /** Edit the selected card in place (on the draft). */
  function edit(mutate: (card: AutoCard) => void, record = true) {
    if (!card) return;
    const id = card.id;
    updateAuto((draft) => {
      const target = findCard(draft.cards, id);
      if (target) mutate(target);
    }, record);
  }

  function editRow(rowIndex: number, mutate: (row: AutoRow) => void, record = true) {
    edit((target) => {
      if (target.kind === "firstOf" && target.rows[rowIndex]) mutate(target.rows[rowIndex]);
    }, record);
  }

  function replaceRow(rowIndex: number, kind: RowKind) {
    edit((target) => {
      if (target.kind !== "firstOf") return;
      target.rows[rowIndex] = rowOfKind(kind, target.rows[rowIndex], auto);
    });
  }

  function moveRow(rowIndex: number, delta: -1 | 1) {
    edit((target) => {
      if (target.kind !== "firstOf") return;
      const to = rowIndex + delta;
      if (to < 0 || to >= target.rows.length) return;
      const [row] = target.rows.splice(rowIndex, 1);
      target.rows.splice(to, 0, row);
    });
  }

  function remove() {
    if (!card) return;
    const id = card.id;
    let next: string | null = null;
    updateAuto((draft) => {
      next = removeCard(draft, id);
    });
    selectedCardId.set(next);
  }

  function duplicate() {
    if (!card) return;
    const id = card.id;
    let copy: string | null = null;
    updateAuto((draft) => {
      copy = duplicateCard(draft, id);
    });
    if (copy) selectedCardId.set(copy);
  }

  function move(delta: -1 | 1) {
    if (!card) return;
    const id = card.id;
    updateAuto((draft) => void moveCard(draft, id, delta));
  }

  const numberOr = (value: string, fallback: number) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
  };
</script>

{#snippet nameSelect(value: string, options: string[], kind: string, onPick: (name: string) => void)}
  <select
    class={FIELD_CLASS}
    class:!border-red-600={!!value && !options.includes(value)}
    {value}
    onchange={(e) => onPick(e.currentTarget.value)}
    aria-label={`Choose ${kind}`}
  >
    {#if !options.includes(value)}
      <option value={value}>{value ? `${value} — not registered` : `(choose ${kind})`}</option>
    {/if}
    {#each options as name (name)}
      <option value={name}>{name}</option>
    {/each}
  </select>
{/snippet}

{#snippet chips(names: string[], options: string[], kind: string, onRemove: (index: number) => void, onAdd: (name: string) => void)}
  <div class="flex flex-wrap items-center gap-1.5">
    {#each names as name, index (name)}
      <span
        class="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px]"
        class:border-[#444444]={options.includes(name)}
        class:bg-[#141414]={options.includes(name)}
        class:border-red-600={!options.includes(name)}
        class:text-red-400={!options.includes(name)}
        title={options.includes(name) ? name : `${name} is not registered`}
      >
        {name}
        <button type="button" class="text-gray-500 hover:text-gray-200" aria-label={`Remove ${name}`} onclick={() => onRemove(index)}>✕</button>
      </span>
    {/each}
    <select
      class="{FIELD_CLASS} !w-auto"
      value=""
      onchange={(e) => {
        const name = e.currentTarget.value;
        e.currentTarget.value = "";
        if (name) onAdd(name);
      }}
      aria-label={`Add ${kind}`}
    >
      <option value="">+ add {kind}…</option>
      {#each options.filter((name) => !names.includes(name)) as name (name)}
        <option value={name}>{name}</option>
      {/each}
    </select>
  </div>
{/snippet}

{#if card}
<div class={SECTION_CLASS}>
  <!-- Shown inside the card list, under its card: the card itself is the title. -->
  <div class="flex items-center justify-end gap-3">
    {#if card}
      <div class="flex flex-wrap items-center justify-end gap-1.5 text-[10px]">
        <button type="button" class={ACTION_CLASS} disabled={!canMove(auto, card.id, -1)} onclick={() => move(-1)} title="Move up">↑</button>
        <button type="button" class={ACTION_CLASS} disabled={!canMove(auto, card.id, 1)} onclick={() => move(1)} title="Move down">↓</button>
        <button type="button" class={ACTION_CLASS} onclick={duplicate}>Duplicate</button>
        <button type="button" class={DANGER_CLASS} onclick={remove}>✕ Delete</button>
      </div>
    {/if}
  </div>

  {#each cardIssues as issue, i (i)}
    <div
      class="border px-2 py-1 text-[11px]"
      class:border-red-700={issue.level === "error"}
      class:bg-red-950={issue.level === "error"}
      class:text-red-300={issue.level === "error"}
      class:border-amber-700={issue.level === "warning"}
      class:text-amber-300={issue.level === "warning"}
      class:bg-amber-950={issue.level === "warning"}
    >
      {issue.level === "error" ? "✕" : "⚠"} {issue.message}
    </div>
  {/each}

  {#if card?.kind === "action"}
    <div class="grid grid-cols-2 gap-2 text-[11px] text-gray-300">
      <div class={CELL_CLASS}>
        <span class={LABEL_CLASS}>Command</span>
        {@render nameSelect(card.name, actions, "a command", (name) => edit((c) => { if (c.kind === "action") c.name = name; }))}
      </div>
      <div class={CELL_CLASS}>
        <label class={LABEL_CLASS} for="auto-command-timeout"
          title="The robot cuts the command off after this long if it has not finished.">Timeout (s)</label>
        <input
          id="auto-command-timeout"
          class={FIELD_CLASS}
          type="number"
          min="0.1"
          step="0.5"
          value={card.timeoutS ?? DEFAULT_TIMEOUT_S}
          oninput={(e) => edit((c) => { if (c.kind === "action") { const s = numberOr(e.currentTarget.value, DEFAULT_TIMEOUT_S); if (s > 0 && s !== DEFAULT_TIMEOUT_S) c.timeoutS = s; else delete c.timeoutS; } }, false)}
          onchange={commitAuto}
        />
        <span class="text-[10px] text-gray-500">
          {auto.registry.typicalS?.[card.name] !== undefined
            ? `typically ${auto.registry.typicalS[card.name]} s`
            : "typical time not in the robot's list"}
        </span>
      </div>
    </div>
  {:else if card?.kind === "path"}
    {@const info = catalog.byId.get(card.lineId)}
    {#if info}
      {@const pinned = auto.pathEnds[info.endSegmentId]}
      <div class="{CELL_CLASS} text-[11px] text-gray-300">
        <label class={LABEL_CLASS} for="auto-path-ends-at">Ends at</label>
        <select
          id="auto-path-ends-at"
          class={FIELD_CLASS}
          value={pinned ?? ""}
          onchange={(e) => pinEnd(info.endSegmentId, e.currentTarget.value)}
        >
          <option value="">A spot of its own ({info.end.x.toFixed(1)}, {info.end.y.toFixed(1)})</option>
          {#each pointNames as name (name)}
            <option value={name}>{name} ({auto.points[name][0]}, {auto.points[name][1]})</option>
          {/each}
        </select>
        {#if !pinned}
          <form class="mt-1.5 flex gap-1.5" onsubmit={(e) => { e.preventDefault(); nameEnd(info.endSegmentId, info.end, info.endHeadingDeg); }}>
            <input class={FIELD_CLASS} placeholder="Name this spot" bind:value={newEndName} aria-label="Name for this path's end" />
            <button type="submit" class="{ACTION_CLASS} shrink-0 text-[10px]" disabled={!newEndName.trim() || !!auto.points[newEndName.trim()]}>Name it</button>
          </form>
        {/if}
      </div>
    {/if}
      <label class="flex cursor-pointer items-center gap-2 px-1 text-[11px] text-gray-300">
        <input
          type="checkbox"
          checked={card.park}
          onchange={(e) => edit((c) => { if (c.kind === "path") c.park = e.currentTarget.checked; })}
        />
        <span class="font-semibold text-gray-100" title="The endgame guard drives this path when time is short.">Park path</span>
      </label>
    <button type="button" class="self-start text-[11px] text-gray-500 hover:text-gray-200" onclick={() => (showMore = !showMore)}>{showMore ? "less ▴" : "more ▾"}</button>
    {#if showMore}
    <div class="grid grid-cols-2 gap-2 text-[11px] text-gray-300">
      <div class="{CELL_CLASS} col-span-2">
        <span class={LABEL_CLASS}>Path</span>
        <select
          class={FIELD_CLASS}
          class:!border-red-600={!info}
          value={card.lineId}
          onchange={(e) => edit((c) => { if (c.kind === "path") c.lineId = e.currentTarget.value; })}
          aria-label="Path to drive"
        >
          {#if !info}
            <option value={card.lineId}>(missing path)</option>
          {/if}
          {#each catalog.paths as path (path.id)}
            <option value={path.id}>{path.name} — to {path.end.x.toFixed(1)}, {path.end.y.toFixed(1)}</option>
          {/each}
        </select>
      </div>
      <div class="{CELL_CLASS} col-span-2">
        <span class={LABEL_CLASS}>Length · time</span>
        <span class="font-mono text-gray-100">{info ? `${info.length.toFixed(0)} in · ${seconds(info.seconds)}` : "—"}</span>
      </div>
    </div>
    <div class={CELL_CLASS}>
      <span class={LABEL_CLASS}>While driving</span>
      {@render chips(
        card.while,
        actions,
        "action",
        (index) => edit((c) => { if (c.kind === "path") c.while.splice(index, 1); }),
        (name) => edit((c) => { if (c.kind === "path" && !c.while.includes(name)) c.while.push(name); }),
      )}
    </div>
    <div class={CELL_CLASS}>
      <span class={LABEL_CLASS}>Events along this path</span>
      <EventsBar
        events={card.events}
        {actions}
        onChange={(events: PathEvent[], done: boolean) =>
          edit((c) => { if (c.kind === "path") c.events = events; }, done)}
      />
    </div>
    {/if}
  {:else if card?.kind === "firstOf"}
    <div class={CELL_CLASS}>
      <label class={LABEL_CLASS} for="auto-firstof-label">{isPlainWait(card) ? "Wait name" : "Question"}</label>
      <input
        id="auto-firstof-label"
        class={FIELD_CLASS}
        value={card.label}
        placeholder={isPlainWait(card) ? "Wait for LauncherReady" : "Did the HIVE tip?"}
        oninput={(e) => edit((c) => { if (c.kind === "firstOf") c.label = e.currentTarget.value; }, false)}
        onchange={commitAuto}
      />
    </div>
    <div class="space-y-2">
      {#each card.rows as row, rowIndex (rowIndex)}
        {@const kind = rowKind(row)}
        {@const rowSelected = selection.rowIndex === rowIndex}
        {@const worstEnd = worst?.rows.get(card.id)?.[rowIndex]}
        <div
          class="space-y-2 border bg-[#1a1a1a] px-2 py-2 text-[11px] text-gray-300"
          class:border-[#333333]={!rowSelected}
          class:border-[#8d68bd]={rowSelected}
          style={`border-left: 3px solid ${branchColor(rowIndex)}`}
        >
          <div class="flex items-center justify-between gap-2">
            <div class="font-semibold" style={`color: ${branchColor(rowIndex)}`}>
              Row {rowIndex + 1}
              {#if preview?.taken.get(card.id) === rowIndex}<span class="ml-1 text-gray-400">· fired in this preview</span>{/if}
            </div>
            <div class="flex items-center gap-1 text-[10px]">
              <button type="button" class={ACTION_CLASS} disabled={rowIndex === 0} onclick={() => moveRow(rowIndex, -1)} aria-label="Move row up">↑</button>
              <button type="button" class={ACTION_CLASS} disabled={rowIndex === card.rows.length - 1} onclick={() => moveRow(rowIndex, 1)} aria-label="Move row down">↓</button>
              <button
                type="button"
                class={ACTION_CLASS}
                onclick={() => edit((c) => { if (c.kind === "firstOf") c.rows.splice(rowIndex, 1); })}
                title={row.cards.length ? `Delete the row and its ${row.cards.length} card(s)` : "Delete the row"}
              >✕</button>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <label class="space-y-1">
              <span class="text-gray-500">Becomes true when</span>
              <select class={FIELD_CLASS} value={kind} onchange={(e) => replaceRow(rowIndex, e.currentTarget.value as RowKind)}>
                {#each ROW_KINDS as option (option.value)}
                  <option value={option.value}>{option.label}</option>
                {/each}
              </select>
            </label>
            {#if kind === "afterMs"}
              <label class="space-y-1">
                <span class="text-gray-500">Milliseconds</span>
                <input class={FIELD_CLASS} type="number" min="0" step="100" value={(row as { afterMs: number }).afterMs}
                  oninput={(e) => editRow(rowIndex, (r) => { if ("afterMs" in r) r.afterMs = numberOr(e.currentTarget.value, r.afterMs); }, false)}
                  onchange={commitAuto} />
              </label>
            {:else if kind === "timeLeftBelowS"}
              <label class="space-y-1">
                <span class="text-gray-500">Seconds left</span>
                <input class={FIELD_CLASS} type="number" min="0" max={AUTO_LENGTH_S} step="0.5" value={(row as { timeLeftBelowS: number }).timeLeftBelowS}
                  oninput={(e) => editRow(rowIndex, (r) => { if ("timeLeftBelowS" in r) r.timeLeftBelowS = numberOr(e.currentTarget.value, r.timeLeftBelowS); }, false)}
                  onchange={commitAuto} />
              </label>
            {:else if kind === "nearPoint"}
              {@const near = row as { nearPoint: string; radiusIn: number }}
              <div class="grid grid-cols-2 gap-1">
                <label class="space-y-1">
                  <span class="text-gray-500">Point</span>
                  <select class={FIELD_CLASS} value={near.nearPoint} onchange={(e) => editRow(rowIndex, (r) => { if ("nearPoint" in r) r.nearPoint = e.currentTarget.value; })}>
                    {#if !pointNames.includes(near.nearPoint)}<option value={near.nearPoint}>{near.nearPoint || "(none)"}</option>{/if}
                    {#each pointNames as name (name)}<option value={name}>{name}</option>{/each}
                  </select>
                </label>
                <label class="space-y-1">
                  <span class="text-gray-500">Within (in)</span>
                  <input class={FIELD_CLASS} type="number" min="0" step="0.5" value={near.radiusIn}
                    oninput={(e) => editRow(rowIndex, (r) => { if ("radiusIn" in r) r.radiusIn = numberOr(e.currentTarget.value, r.radiusIn); }, false)}
                    onchange={commitAuto} />
                </label>
              </div>
            {:else if kind === "inArea"}
              {@const area = (row as { inArea: [string, string] }).inArea}
              <div class="grid grid-cols-2 gap-1">
                {#each [0, 1] as corner (corner)}
                  <label class="space-y-1">
                    <span class="text-gray-500">Corner {corner + 1}</span>
                    <select class={FIELD_CLASS} value={area[corner]} onchange={(e) => editRow(rowIndex, (r) => { if ("inArea" in r) r.inArea[corner] = e.currentTarget.value; })}>
                      {#if !pointNames.includes(area[corner])}<option value={area[corner]}>{area[corner] || "(none)"}</option>{/if}
                      {#each pointNames as name (name)}<option value={name}>{name}</option>{/each}
                    </select>
                  </label>
                {/each}
              </div>
            {:else if kind === "otherwise"}
              <div class="self-end pb-1 text-gray-500">True at once: the "else" of an if.</div>
            {/if}
          </div>
          {#if kind === "when"}
            <div class="space-y-1">
              <span class="text-gray-500">Any of</span>
              {@render chips(
                (row as { when: string[] }).when,
                conditions,
                "condition",
                (index) => editRow(rowIndex, (r) => { if ("when" in r) r.when.splice(index, 1); }),
                (name) => editRow(rowIndex, (r) => { if ("when" in r && !r.when.includes(name)) r.when.push(name); }),
              )}
            </div>
          {/if}
          <div class="grid grid-cols-[1fr_auto] items-end gap-2">
            <label class="space-y-1">
              <span class="text-gray-500">Branch name</span>
              <input class={FIELD_CLASS} value={row.label ?? ""} placeholder={rowLabel({ ...row, label: undefined })}
                oninput={(e) => editRow(rowIndex, (r) => { const v = e.currentTarget.value; if (v.trim()) r.label = v; else delete r.label; }, false)}
                onchange={commitAuto} />
            </label>
            <button
              type="button"
              class={ACTION_CLASS}
              onclick={() => selectedCardId.set(`${card!.id}#${rowIndex}`)}
              title="New cards from the Auto list's buttons go at the end of this branch"
            >
              {row.cards.length} card{row.cards.length === 1 ? "" : "s"} · add here
            </button>
          </div>
          {#if row.cards.length > 0 && worstEnd !== undefined}
            <div class="text-[10px]" class:text-red-400={worstEnd !== null && worstEnd > AUTO_LENGTH_S} class:text-gray-500={worstEnd === null || worstEnd <= AUTO_LENGTH_S}>
              {worstEnd === null
                ? "Worst case: this row never wins when every wait runs to its time row."
                : `Worst case with this branch: the Auto ends by ${seconds(worstEnd)}${worstEnd > AUTO_LENGTH_S ? " — over 30 s" : ""}.`}
            </div>
          {/if}
        </div>
      {/each}
      <div class="flex flex-wrap gap-1.5 text-[10px]">
        <button type="button" class={ACTION_CLASS} onclick={() => edit((c) => { if (c.kind === "firstOf") c.rows.push(rowOfKind(conditions.length ? "when" : "afterMs", null, auto)); })}>+ Condition row</button>
        <button type="button" class={ACTION_CLASS} onclick={() => edit((c) => { if (c.kind === "firstOf") c.rows.push(rowOfKind("afterMs", null, auto)); })}>+ Time row</button>
        <button type="button" class={ACTION_CLASS} onclick={() => edit((c) => { if (c.kind === "firstOf") c.rows.push(rowOfKind("otherwise", null, auto)); })}>+ Otherwise</button>
      </div>
    </div>
  {:else if card?.kind === "routine"}
    {@const placement = placementAt(auto.points, card.at, card.facingDeg, card.mirror)}
    {@const routine = auto.routines[card.routine]}
    {@const fit = placement && routine
      ? checkFit(segmentSamples(placeRoutine(routine, placement), { x: placement.x, y: placement.y }), shapes, Math.max(catalog.settings.rWidth, catalog.settings.rHeight))
      : null}
    <div class="grid grid-cols-2 gap-2 text-[11px] text-gray-300">
      <div class={CELL_CLASS}>
        <span class={LABEL_CLASS}>Routine</span>
        <select class={FIELD_CLASS} value={card.routine} class:!border-red-600={!routine}
          onchange={(e) => {
            const value = e.currentTarget.value;
            if (value === "__new") {
              let name = "NewRoutine";
              for (let i = 2; auto.routines[name]; i++) name = `NewRoutine${i}`;
              updateAuto((draft) => {
                draft.routines[name] = { steps: [{ forward: 12, left: 0 }], endsWhen: draft.registry.conditions[0] ?? "", timeoutMs: 2000, while: [], exit: [] };
                const target = findCard(draft.cards, card!.id);
                if (target?.kind === "routine") target.routine = name;
              });
            } else edit((c) => { if (c.kind === "routine") c.routine = value; });
          }}>
          {#if !routine}<option value={card.routine}>{card.routine || "(choose)"}</option>{/if}
          {#each Object.keys(auto.routines) as name (name)}<option value={name}>{name}</option>{/each}
          <option value="__new">+ New routine…</option>
        </select>
      </div>
      <div class={CELL_CLASS}>
        <span class={LABEL_CLASS}>Starts at</span>
        <select class={FIELD_CLASS} value={card.at} class:!border-red-600={!auto.points[card.at]}
          onchange={(e) => edit((c) => { if (c.kind === "routine") c.at = e.currentTarget.value; })}>
          {#if !auto.points[card.at]}<option value={card.at}>{card.at || "(choose a point)"}</option>{/if}
          {#each pointNames as name (name)}<option value={name}>{name}</option>{/each}
        </select>
      </div>
      <div class={CELL_CLASS}>
        <label class={LABEL_CLASS} for="auto-routine-facing">Facing (°)</label>
        <input id="auto-routine-facing" class={FIELD_CLASS} type="number" step="15" value={card.facingDeg}
          oninput={(e) => edit((c) => { if (c.kind === "routine") { const v = Number(e.currentTarget.value); if (Number.isFinite(v)) c.facingDeg = v; } }, false)}
          onchange={commitAuto} />
      </div>
      <div class={CELL_CLASS}>
        <span class={LABEL_CLASS}>Exits to</span>
        <select class={FIELD_CLASS} value={card.exit} class:!border-red-600={!auto.points[card.exit]}
          onchange={(e) => edit((c) => { if (c.kind === "routine") c.exit = e.currentTarget.value; })}>
          {#if !auto.points[card.exit]}<option value={card.exit}>{card.exit || "(choose a point)"}</option>{/if}
          {#each pointNames as name (name)}<option value={name}>{name}</option>{/each}
        </select>
      </div>
    </div>
    <label class="flex items-center gap-2 text-[11px] text-gray-300">
      <input type="checkbox" checked={card.mirror} onchange={(e) => edit((c) => { if (c.kind === "routine") c.mirror = e.currentTarget.checked; })} />
      Mirror the pattern left ↔ right
    </label>
    {#if fit}
      <div class="text-[11px]" class:text-green-400={fit.ok} class:text-red-400={!fit.ok}>
        {fit.ok
          ? `✓ Fits here: ${fit.wallMargin.toFixed(1)} in to the nearest wall, clear of the keep-out zones.`
          : `✕ Doesn't fit here: it ${fit.problems.join(", and ")}.`}
      </div>
    {/if}
    <RoutineEditor {auto} name={card.routine} settings={catalog.settings} />
  {:else if card?.kind === "goTo"}
    <div class="grid grid-cols-2 gap-2 text-[11px] text-gray-300">
      <div class="{CELL_CLASS} col-span-2">
        <label class={LABEL_CLASS} for="auto-goto-label">Name</label>
        <input id="auto-goto-label" class={FIELD_CLASS} value={card.label} placeholder={cardTitle({ ...card, label: "" })}
          oninput={(e) => edit((c) => { if (c.kind === "goTo") c.label = e.currentTarget.value; }, false)} onchange={commitAuto} />
      </div>
      <div class={CELL_CLASS}>
        <span class={LABEL_CLASS}>Point</span>
        <select class={FIELD_CLASS} value={card.point} class:!border-red-600={!auto.points[card.point]}
          onchange={(e) => edit((c) => { if (c.kind === "goTo") c.point = e.currentTarget.value; })}>
          {#if !auto.points[card.point]}<option value={card.point}>{card.point || "(choose a point)"}</option>{/if}
          {#each pointNames as name (name)}<option value={name}>{name}</option>{/each}
        </select>
      </div>
      <div class={CELL_CLASS}>
        <label class={LABEL_CLASS} for="auto-goto-max">Only if within (in)</label>
        <input id="auto-goto-max" class={FIELD_CLASS} type="number" min="1" step="1" value={card.maxDistanceIn}
          oninput={(e) => edit((c) => { if (c.kind === "goTo") { const v = Number(e.currentTarget.value); if (v > 0) c.maxDistanceIn = v; } }, false)}
          onchange={commitAuto} />
      </div>
    </div>
    <div class="flex items-center justify-between gap-2 text-[11px] text-gray-500">
      <span></span>
      <button type="button" class="{ACTION_CLASS} shrink-0 text-[10px]" onclick={() => selectedCardId.set(`${card!.id}#0`)}>
        {card.ifRefused.length} card{card.ifRefused.length === 1 ? "" : "s"} · add here
      </button>
    </div>
  {:else if card?.kind === "together"}
    <div class="grid grid-cols-2 gap-2 text-[11px] text-gray-300">
      <div class={CELL_CLASS}>
        <label class={LABEL_CLASS} for="auto-together-label">Name</label>
        <input id="auto-together-label" class={FIELD_CLASS} value={card.label} placeholder="Together"
          oninput={(e) => edit((c) => { if (c.kind === "together") c.label = e.currentTarget.value; }, false)} onchange={commitAuto} />
      </div>
      <div class={CELL_CLASS}>
        <span class={LABEL_CLASS}>Done when</span>
        <select class={FIELD_CLASS} value={card.ends}
          onchange={(e) => edit((c) => { if (c.kind === "together") c.ends = e.currentTarget.value === "FIRST" ? "FIRST" : "ALL"; })}>
          <option value="ALL">all of them are done</option>
          <option value="FIRST">the first one is done</option>
        </select>
      </div>
    </div>
    <div class="flex items-center justify-between gap-2 text-[11px] text-gray-500">
      <span></span>
      <button type="button" class="{ACTION_CLASS} shrink-0 text-[10px]" onclick={() => selectedCardId.set(`${card!.id}#0`)}>
        {card.cards.length} card{card.cards.length === 1 ? "" : "s"} · add here
      </button>
    </div>
  {/if}
</div>
{/if}
