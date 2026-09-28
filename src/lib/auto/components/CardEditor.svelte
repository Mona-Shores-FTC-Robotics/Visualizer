<script lang="ts">
  import type { PathCatalog } from "../geometry";
  import type { AutoIssue } from "../validate";
  import type { PreviewResult, WorstCase } from "../simulate";
  import { AUTO_LENGTH_S } from "../simulate";
  import {
    rowKind,
    type AutoCard,
    type AutoRow,
    type AutoSection,
    type PathEvent,
    type RowKind,
  } from "../types";
  import { findCard, isPlainWait, locateCard, rowLabel } from "../tree";
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
  }

  let { auto, catalog, issues, preview, worst }: Props = $props();

  let selection = $derived(parseSelection($selectedCardId));
  let card: AutoCard | null = $derived(findCard(auto.cards, selection.cardId));
  let cardIssues = $derived(card ? issues.filter((issue) => issue.cardId === card!.id) : []);
  let where = $derived.by(() => {
    if (!card) return "";
    const location = locateCard(auto.cards, card.id);
    if (!location?.parent) return "Main sequence";
    const parent = location.parent;
    return `${rowLabel(parent.card.rows[parent.rowIndex])} · in ${parent.card.label || "a decision"}`;
  });
  let actions = $derived(auto.registry.actions);
  let conditions = $derived(auto.registry.conditions);
  let pointNames = $derived(Object.keys(auto.points));

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

<div class={SECTION_CLASS}>
  <div class="flex items-start justify-between gap-3 border-b border-[#333333] pb-2">
    <div>
      <div class="font-semibold text-gray-100">
        {#if !card}
          Selected Card
        {:else if card.kind === "action"}
          Selected Action
        {:else if card.kind === "path"}
          Selected Path Card
        {:else if isPlainWait(card)}
          Selected Wait
        {:else}
          Selected Decision
        {/if}
      </div>
      <div class="text-[11px] text-gray-500">
        {card ? where : "Pick a card in the Auto list to edit it."}
      </div>
    </div>
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
        <span class={LABEL_CLASS}>Action</span>
        {@render nameSelect(card.name, actions, "an action", (name) => edit((c) => { if (c.kind === "action") c.name = name; }))}
      </div>
      <div class={CELL_CLASS}>
        <label class={LABEL_CLASS} for="auto-action-ms">Takes about (ms)</label>
        <input
          id="auto-action-ms"
          class={FIELD_CLASS}
          type="number"
          min="0"
          step="100"
          value={card.previewMs ?? 0}
          oninput={(e) => edit((c) => { if (c.kind === "action") { const ms = numberOr(e.currentTarget.value, 0); if (ms > 0) c.previewMs = ms; else delete c.previewMs; } }, false)}
          onchange={commitAuto}
        />
      </div>
    </div>
    <div class="text-[11px] text-gray-500">
      The time is for the preview only; on the robot the action takes as long as it takes.
    </div>
  {:else if card?.kind === "path"}
    {@const info = catalog.byId.get(card.lineId)}
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
      <div class={CELL_CLASS}>
        <span class={LABEL_CLASS}>Length · time</span>
        <span class="font-mono text-gray-100">{info ? `${info.length.toFixed(0)} in · ${seconds(info.seconds)}` : "—"}</span>
      </div>
      <label class="{CELL_CLASS} flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          checked={card.park}
          onchange={(e) => edit((c) => { if (c.kind === "path") c.park = e.currentTarget.checked; })}
        />
        <span>
          <span class="block font-semibold text-gray-100">Park path</span>
          <span class="text-gray-500">The endgame guard drives this when time is short.</span>
        </span>
      </label>
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
    <div class="text-[11px] text-gray-500">
      Waits for the <b class="text-gray-300">first</b> of these rows to become true, then runs that row's cards.
      Every wait needs a time row so it cannot wait forever.
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
              <span class="text-gray-500">Any of these registered conditions</span>
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
  {:else}
    <div class="text-[11px] text-gray-500">
      Each card runs after the one above it. A decision waits for the first of its rows and runs that row's
      branch; the cards after the decision continue from there.
    </div>
  {/if}
</div>
