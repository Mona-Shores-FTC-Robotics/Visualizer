<script lang="ts">
  import type { PathCatalog } from "../geometry";
  import type { AutoIssue } from "../validate";
  import type { PreviewResult, WorstCase } from "../simulate";
  import { AUTO_LENGTH_S } from "../simulate";
  import type { AutoCard, AutoSection, FirstOfCard } from "../types";
  import { allCards, cardTitle, childLists, describeRow, isPlainWait, rowLabel } from "../tree";
  import { branchKey, foldedBranches, foldSummary, toggleFolded, unfoldAround } from "../fold";
  import { insertNewCard, moveCard, removeCard, canMove, type NewCardKind } from "../edit";
  import {
    addNewPath,
    parseSelection,
    selectedCardId,
    updateAuto,
  } from "../store";
  import { branchColor, cardColors, seconds, TRUNK_COLOR } from "./ui";
  import AnswerChip from "./AnswerChip.svelte";
  import { rowKind } from "../types";

  interface Props {
    auto: AutoSection;
    catalog: PathCatalog;
    issues: AutoIssue[];
    preview: PreviewResult | null;
    worst: WorstCase | null;
  }

  let { auto, catalog, issues, preview, worst }: Props = $props();

  let selection = $derived(parseSelection($selectedCardId));
  let colors = $derived(cardColors(auto.cards));
  let registeredActions = $derived(new Set(auto.registry.actions));
  let cardCount = $derived.by(() => {
    let count = 0;
    const walk = (list: AutoCard[]) =>
      list.forEach((card) => {
        count += 1;
        childLists(card).forEach(walk);
      });
    walk(auto.cards);
    return count;
  });
  /** Whether the less common card kinds (routine, go to, together) are offered. */
  let showMore = $state(false);

  let parkBranches = $derived.by(() => {
    const labels: string[] = [];
    const walk = (list: AutoCard[], label: string) => {
      if (list.some((card) => card.kind === "path" && card.park)) labels.push(label);
      list.forEach((card) => {
        if (card.kind === "firstOf") card.rows.forEach((row) => walk(row.cards, rowLabel(row)));
        if (card.kind === "goTo") walk(card.ifRefused, `${cardTitle(card)}: if refused`);
      });
    };
    walk(auto.cards, "Auto");
    return labels;
  });

  // Selecting a card (in the list, on the field, or by adding one) opens the
  // folded branches around it, so the selection is always in view.
  $effect(() => {
    const id = selection.cardId;
    if (id) foldedBranches.update((folded) => unfoldAround(folded, auto.cards, id));
  });

  function toggleFold(key: string) {
    foldedBranches.update((folded) => toggleFolded(folded, key));
  }

  function nameOf(card: AutoCard): string {
    return card.kind === "path" ? pathName(card.lineId) : cardTitle(card);
  }

  /** The worst issue anywhere in a folded branch, so folding never hides one. */
  function levelInside(list: AutoCard[]): "error" | "warning" | null {
    let worst: "error" | "warning" | null = null;
    for (const card of allCards(list)) {
      const level = levelOf(card.id);
      if (level === "error") return "error";
      worst ??= level;
    }
    return worst;
  }

  function levelOf(cardId: string): "error" | "warning" | null {
    const own = issues.filter((issue) => issue.cardId === cardId);
    if (own.some((issue) => issue.level === "error")) return "error";
    return own.length ? "warning" : null;
  }

  function add(kind: NewCardKind) {
    if (kind === "path") return addNewPath("after");
    let created: string | null = null;
    updateAuto((draft) => {
      created = insertNewCard(draft, kind, catalog, selection);
    });
    if (created) selectedCardId.set(created);
  }

  function move(id: string, delta: -1 | 1) {
    updateAuto((draft) => void moveCard(draft, id, delta));
  }

  function remove(id: string) {
    let next: string | null = null;
    updateAuto((draft) => {
      next = removeCard(draft, id);
    });
    selectedCardId.set(next);
  }

  function select(id: string) {
    selectedCardId.set($selectedCardId === id ? null : id);
  }

  function pathName(lineId: string): string {
    return catalog.byId.get(lineId)?.name ?? catalog.names.get(lineId) ?? "(missing path)";
  }

  function isOff(cardId: string): boolean {
    return preview !== null && !preview.ran.has(cardId);
  }

  function firstOfSummary(card: FirstOfCard): string {
    return card.rows.map(describeRow).join(" · ") || "no rows";
  }

  /** The branches a card shows in the list: a decision's rows, or its one inner list. */
  function branchesOf(card: AutoCard): { label: string; detail: string; cards: AutoCard[]; color: string; asks: string[] }[] {
    if (card.kind === "firstOf") {
      return card.rows.map((row, index) => ({
        label: row.cards.length || row.label ? rowLabel(row) : describeRow(row),
        detail: describeRow(row),
        cards: row.cards,
        color: branchColor(index),
        // The conditions this row asks; the preview's answers sit next to them.
        asks: rowKind(row) === "when" ? (row as { when: string[] }).when : [],
      }));
    }
    if (card.kind === "goTo") {
      return [{ label: `If refused (over ${card.maxDistanceIn} in away)`, detail: "", cards: card.ifRefused, color: "#ff8a3d", asks: [] }];
    }
    if (card.kind === "together") {
      return [{ label: card.ends === "ALL" ? "Together, until all are done" : "Together, until the first is done", detail: "", cards: card.cards, color: "#5fd4e6", asks: [] }];
    }
    return [];
  }
</script>

{#snippet cardButton(card: AutoCard)}
  {@const selected = selection.cardId === card.id && selection.rowIndex === null}
  {@const level = levelOf(card.id)}
  <div
    class="list-item-box compact auto-card"
    class:list-item-box--selected={selected}
    class:auto-card--off={isOff(card.id)}
    style={`border-left: 3px solid ${colors.get(card.id) ?? TRUNK_COLOR}`}
  >
    <button type="button" class="auto-card-main" onclick={() => select(card.id)}>
      <div class="list-item-top">
        {#if card.kind === "action"}
          <span class="auto-icon auto-icon--action" aria-hidden="true">▶</span>
          <span class="list-item-name">{card.name || "(choose an action)"}</span>
        {:else if card.kind === "path"}
          <span class="auto-icon auto-icon--path" aria-hidden="true">↝</span>
          <span class="list-item-name">{pathName(card.lineId)}</span>
          {#if card.park}<span class="auto-tag">park</span>{/if}
        {:else if card.kind === "firstOf"}
          <span
            class="auto-icon"
            class:auto-icon--wait={isPlainWait(card)}
            class:auto-icon--decision={!isPlainWait(card)}
            aria-hidden="true">{isPlainWait(card) ? "⏳" : "◆"}</span
          >
          <span class="list-item-name">{card.label || (isPlainWait(card) ? "Wait for" : "Decision")}</span>
        {:else if card.kind === "routine"}
          <span class="auto-icon auto-icon--routine" aria-hidden="true">◇</span>
          <span class="list-item-name">{cardTitle(card)}</span>
        {:else if card.kind === "goTo"}
          <span class="auto-icon auto-icon--routine" aria-hidden="true">⇢</span>
          <span class="list-item-name">{cardTitle(card)}</span>
        {:else}
          <span class="auto-icon auto-icon--wait" aria-hidden="true">⇉</span>
          <span class="list-item-name">{cardTitle(card)}</span>
        {/if}
        {#if level}
          <span class="auto-flag auto-flag--{level}" title={level === "error" ? "Blocks the Java export" : "Warning"}
            >{level === "error" ? "!" : "⚠"}</span
          >
        {/if}
      </div>
      <div class="list-item-sub">
        {#if card.kind === "action"}
          action{card.previewMs ? ` · ~${(card.previewMs / 1000).toFixed(1)} s` : " · instant"}
          {#if card.name && !registeredActions.has(card.name)}<span class="auto-bad"> · not registered</span>{/if}
        {:else if card.kind === "path"}
          {@const info = catalog.byId.get(card.lineId)}
          {#if info}
            to {info.end.x.toFixed(1)}, {info.end.y.toFixed(1)} · {seconds(info.seconds)}
          {:else}
            <span class="auto-bad">path not found</span>
          {/if}
        {:else if card.kind === "firstOf"}
          {isPlainWait(card) ? "wait for the first of" : "first of"}: {firstOfSummary(card)}
        {:else if card.kind === "routine"}
          {@const routine = auto.routines[card.routine]}
          routine · {routine?.endsWhen ? `until ${routine.endsWhen}` : "no end condition"} · exit → {card.exit || "?"}
        {:else if card.kind === "goTo"}
          straight to {card.point || "?"} if within {card.maxDistanceIn} in
        {:else}
          {card.cards.length} card{card.cards.length === 1 ? "" : "s"} at once
        {/if}
      </div>
      {#if card.kind === "routine" && auto.routines[card.routine]}
        {@const routine = auto.routines[card.routine]}
        <div class="auto-minis">
          {#each routine.while as name (name)}
            <span class="auto-mini" class:auto-mini--bad={!registeredActions.has(name)}>while {name}</span>
          {/each}
          {#each routine.exit as name (name)}
            <span class="auto-mini" class:auto-mini--bad={!registeredActions.has(name)}>exit: {name}</span>
          {/each}
        </div>
      {/if}
      {#if card.kind === "path" && (card.while.length || card.events.length)}
        <div class="auto-minis">
          {#each card.while as name (name)}
            <span class="auto-mini" class:auto-mini--bad={!registeredActions.has(name)}>while {name}</span>
          {/each}
          {#each card.events as event, i (i)}
            <span class="auto-mini auto-mini--event" class:auto-mini--bad={!registeredActions.has(event.action)}
              >⚡ {event.action} {Math.round(event.at * 100)}%</span
            >
          {/each}
        </div>
      {/if}
    </button>
    {#if card.kind === "routine" && auto.routines[card.routine]?.endsWhen}
      <div class="auto-card-answers">
        <span class="auto-answers-label">ends when</span>
        <AnswerChip cardId={card.id} condition={auto.routines[card.routine].endsWhen} />
      </div>
    {/if}
    {#if selected}
      <div class="auto-card-tools">
        <button type="button" class="path-list-action" title="Move up" aria-label="Move up"
          disabled={!canMove(auto, card.id, -1)} onclick={() => move(card.id, -1)}>↑</button>
        <button type="button" class="path-list-action" title="Move down" aria-label="Move down"
          disabled={!canMove(auto, card.id, 1)} onclick={() => move(card.id, 1)}>↓</button>
        <button type="button" class="path-list-action" title="Delete card" aria-label="Delete card"
          onclick={() => remove(card.id)}>✕</button>
      </div>
    {/if}
  </div>
{/snippet}

{#snippet cardList(list: AutoCard[])}
  {#each list as card (card.id)}
    {#if childLists(card).length > 0}
      <div class="path-group" class:path-group--selected={selection.cardId === card.id}>
        {@render cardButton(card)}
        {#each branchesOf(card) as row, rowIndex (rowIndex)}
          {@const rowSelected = selection.cardId === card.id && selection.rowIndex === rowIndex}
          {@const takenHere = preview?.taken.get(card.id) === rowIndex}
          {@const worstEnd = worst?.rows.get(card.id)?.[rowIndex]}
          {@const key = branchKey(card.id, rowIndex)}
          {@const folded = row.cards.length > 0 && $foldedBranches.has(key)}
          <div
            class="auto-branch"
            class:auto-branch--off={preview !== null && preview.ran.has(card.id) && !takenHere && card.kind !== "together"}
            style={`--c: ${row.color}`}
          >
            <div class="auto-branch-row">
            {#if row.cards.length}
              <button
                type="button"
                class="auto-fold"
                aria-expanded={!folded}
                aria-label={folded ? `Open ${row.label}` : `Fold ${row.label}`}
                title={folded ? "Open this branch" : "Fold this branch"}
                onclick={() => toggleFold(key)}>{folded ? "▸" : "▾"}</button
              >
            {:else}
              <span class="auto-fold auto-fold--empty" aria-hidden="true"></span>
            {/if}
            <button
              type="button"
              class="auto-branch-h"
              class:auto-branch-h--selected={rowSelected}
              onclick={() => selectedCardId.set(rowSelected ? card.id : `${card.id}#${rowIndex}`)}
              title="Select this branch: new cards go at its end"
            >
              <span class="auto-branch-name">{row.label}</span>
              <span class="auto-branch-meta">
                {#if takenHere}<span class="auto-run">this preview</span>{/if}
                {#if row.cards.length && card.kind !== "together"}
                  {#if worstEnd === null || worstEnd === undefined}
                    <span class="auto-worst" title="Can never fire when every wait runs to its time row">—</span>
                  {:else}
                    <span
                      class="auto-worst"
                      class:auto-worst--over={worstEnd > AUTO_LENGTH_S}
                      title="Worst case: the Auto ends by then if this branch is taken">≤ {seconds(worstEnd)}</span
                    >
                  {/if}
                {/if}
              </span>
            </button>
            {#each row.asks as condition (condition)}
              <AnswerChip cardId={card.id} {condition} named={!row.label.includes(condition)} />
            {/each}
            </div>
            {#if folded}
              {@const level = levelInside(row.cards)}
              {@const summary = foldSummary(row.cards, nameOf)}
              <button type="button" class="auto-fold-summary" title={`${summary}\nClick to open this branch`} onclick={() => toggleFold(key)}>
                <span class="auto-fold-text">{summary}</span>
                {#if level}
                  <span class="auto-flag auto-flag--{level}" title={level === "error" ? "A card in here blocks the Java export" : "A card in here has a warning"}
                    >{level === "error" ? "!" : "⚠"}</span
                  >
                {/if}
              </button>
            {:else if row.cards.length}
              <div class="auto-branch-cards">
                {@render cardList(row.cards)}
              </div>
            {:else if rowSelected}
              <div class="list-empty">No cards yet. Add cards with the buttons above.</div>
            {/if}
          </div>
        {/each}
      </div>
    {:else}
      {@render cardButton(card)}
    {/if}
  {/each}
{/snippet}

<section class="module-box module-fill auto-list-box">
  <div class="module-header-row">
    <h3 class="module-title">Auto</h3>
    <span class="module-caption">{cardCount} card{cardCount === 1 ? "" : "s"} · drawn for {auto.drawnFor}</span>
  </div>
  <div class="auto-add-row">
    <button type="button" class="path-list-action" onclick={() => add("action")} title="Add an action after the selected card">+ Action</button>
    <button type="button" class="path-list-action" onclick={() => add("wait")} title="Add a wait: the first of a condition or a time">+ Wait for</button>
    <button type="button" class="path-list-action" onclick={() => add("decision")} title="Add a decision with a branch per row">+ Decision</button>
    <button type="button" class="path-list-action" onclick={() => add("path")} title="A new path from where the robot is">+ Path</button>
    <button type="button" class="path-list-action" onclick={() => (showMore = !showMore)} aria-expanded={showMore}
      title="Routines, go-to and cards that run together">{showMore ? "Less ▴" : "More ▾"}</button>
    {#if showMore}
      <button type="button" class="path-list-action" onclick={() => add("routine")} title="Run a routine placed at a named point">+ Routine</button>
      <button type="button" class="path-list-action" onclick={() => add("goTo")} title="Drive straight to a named point, if it is close enough">+ Go to</button>
      <button type="button" class="path-list-action" onclick={() => add("together")} title="Run several cards at the same time">+ Together</button>
    {/if}
  </div>

  <div class="module-list" role="list">
    {@render cardList(auto.cards)}
    {#if auto.cards.length === 0}
      <div class="list-empty">No cards yet. Start with + Action or + Path.</div>
    {/if}
    <!-- The endgame guard shows once a branch has a park path to use. -->
    {#if parkBranches.length}
    <div class="list-item-box compact auto-guard">
      <div class="list-item-top">
        <span class="auto-icon auto-icon--wait" aria-hidden="true">⏱</span>
        <span class="list-item-name">Endgame: park when time is short</span>
      </div>
      <div class="list-item-sub">
        Parks from: {parkBranches.join(", ")}
        {#if preview?.guard}<span class="auto-bad"> · used in this preview at {preview.guard.t.toFixed(1)} s</span>{/if}
      </div>
    </div>
    {/if}
  </div>
</section>

<style>
  .auto-list-box {
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  .auto-add-row {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 8px;
  }
  .auto-add-hint {
    margin-top: 4px;
  }
  .auto-card {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .auto-card--off {
    opacity: 0.5;
  }
  .auto-card-main {
    display: block;
    width: 100%;
    text-align: left;
    background: none;
    border: none;
    padding: 0;
  }
  .auto-card-answers {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 0.62rem;
    color: #888888;
  }
  .auto-card-tools {
    display: flex;
    gap: 4px;
    justify-content: flex-end;
  }
  .auto-icon {
    width: 16px;
    height: 16px;
    flex: none;
    display: inline-grid;
    place-items: center;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 700;
  }
  .auto-icon--action {
    background: #2b2410;
    color: #ffc516;
  }
  .auto-icon--path {
    background: #2b2410;
    color: #ffc516;
    font-size: 12px;
  }
  .auto-icon--wait {
    background: #202020;
    color: #bbbbbb;
  }
  .auto-icon--routine {
    background: #10262a;
    color: #5fd4e6;
  }
  .auto-icon--decision {
    background: #251f3d;
    color: #a594ff;
  }
  .auto-tag {
    font-size: 0.6rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: #ff9a9a;
    border: 1px solid #6b3a3a;
    border-radius: 4px;
    padding: 0 4px;
  }
  .auto-flag {
    margin-left: auto;
    font-size: 0.68rem;
    font-weight: 800;
    border-radius: 4px;
    padding: 0 5px;
  }
  .auto-flag--error {
    background: #5c1a1a;
    color: #ff9a9a;
  }
  .auto-flag--warning {
    background: #3d2e0a;
    color: #f5c451;
  }
  .auto-bad {
    color: #ff7a7a;
  }
  .auto-minis {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 4px;
  }
  .auto-mini {
    font-size: 0.64rem;
    border: 1px solid #444444;
    border-radius: 5px;
    padding: 0 5px;
    color: #cfcfcf;
    background: #101010;
    white-space: nowrap;
  }
  .auto-mini--event {
    border-color: #5c4a10;
    color: #ffc516;
  }
  .auto-mini--bad {
    border-color: #e5484d;
    color: #ff7a7a;
  }
  .auto-branch {
    display: flex;
    flex-direction: column;
    gap: 5px;
    padding-left: 8px;
    margin-left: 4px;
    border-left: 2px solid var(--c);
  }
  .auto-branch--off {
    opacity: 0.55;
    border-left-style: dashed;
  }
  .auto-branch-row {
    display: flex;
    align-items: center;
    gap: 2px;
  }
  .auto-fold {
    flex: none;
    width: 16px;
    height: 16px;
    display: inline-grid;
    place-items: center;
    background: none;
    border: none;
    border-radius: 4px;
    padding: 0;
    font-size: 0.7rem;
    color: var(--c);
  }
  button.auto-fold:hover {
    background: #1c1c1c;
  }
  .auto-fold-summary {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    background: #141414;
    border: 1px dashed #333333;
    border-radius: 5px;
    padding: 3px 6px;
    text-align: left;
    font-size: 0.66rem;
    color: #aaaaaa;
  }
  .auto-fold-summary:hover {
    border-color: var(--c);
  }
  .auto-fold-text {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .auto-branch-h {
    flex: 1;
    min-width: 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 6px;
    width: 100%;
    background: none;
    border: 1px solid transparent;
    border-radius: 5px;
    padding: 1px 4px;
    text-align: left;
    font-size: 0.7rem;
    font-weight: 700;
    color: var(--c);
  }
  .auto-branch-h:hover {
    background: #1c1c1c;
  }
  .auto-branch-h--selected {
    border-color: #8d68bd;
    background: #1d1727;
  }
  .auto-branch-name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .auto-branch-meta {
    display: flex;
    gap: 4px;
    flex: none;
  }
  .auto-run {
    font-size: 0.62rem;
    background: color-mix(in srgb, var(--c) 18%, transparent);
    padding: 0 5px;
    border-radius: 4px;
  }
  .auto-worst {
    font-size: 0.62rem;
    font-weight: 600;
    color: #999999;
  }
  .auto-worst--over {
    color: #ff7a7a;
  }
  .auto-branch-cards {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .auto-guard {
    border-style: dashed;
    border-color: #6b3a3a;
    background: #161010;
  }
</style>
