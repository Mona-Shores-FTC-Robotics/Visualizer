<script lang="ts">
  /**
   * The inbox on the planning page: partners' Autos sent through the Google Form (share.html's
   * "Send to Ultraviolet / Infrared"), newest first. A tap opens one as their Auto. Rows are untrusted:
   * `readInbox` keeps only our own links, rebuilt by our code, and they are shown as text only.
   */
  import { onMount } from "svelte";
  import { fetchInbox, OUR_NAMES, readInbox, type InboxEntry } from "./inbox";

  let { onOpen }: { onOpen: (hash: string) => void } = $props();

  let entries = $state.raw<InboxEntry[] | null>(null);
  let problem = $state<string | null>(null);
  let checking = $state(false);
  let checkedAt = $state<number | null>(null);

  async function check() {
    if (checking) return;
    checking = true;
    try {
      entries = readInbox(await fetchInbox(), location.href);
      problem = null;
      checkedAt = Date.now();
    } catch (error) {
      problem = error instanceof Error ? error.message : String(error);
    } finally {
      checking = false;
    }
  }

  const clock = (t: number) =>
    new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  function when(t: number | null): string {
    if (t === null) return "";
    const d = new Date(t);
    const today = new Date().toDateString() === d.toDateString();
    return today
      ? clock(t)
      : `${d.toLocaleDateString([], { month: "short", day: "numeric" })} ${clock(t)}`;
  }

  onMount(() => void check());
</script>

<div class="inbox" aria-label="Inbox">
  <div class="head">
    <h3>Inbox</h3>
    <button type="button" class="filebtn" onclick={check} disabled={checking}
      >{checking ? "Checking…" : "Check again"}</button
    >
  </div>
  {#if problem}
    <p class="note warn">
      Could not read the inbox: {problem} Scan their QR code instead.
    </p>
  {/if}
  {#if entries && entries.length}
    <ul>
      {#each entries as entry, i (i)}
        <li>
          <button type="button" onclick={() => onOpen(entry.hash)}>
            <b>{entry.team}</b>
            <span>{entry.name}</span>
            <small>{when(entry.time)}</small>
          </button>
        </li>
      {/each}
    </ul>
  {:else if entries}
    <p class="note">Nothing sent yet.</p>
  {/if}
  <p class="note">
    Partners send these from the share page's "Send to {OUR_NAMES}". A new one
    takes a few minutes to show up here{checkedAt
      ? ` (checked ${clock(checkedAt)})`
      : ""}.
  </p>
</div>

<style>
  .inbox {
    display: grid;
    gap: 8px;
    margin-bottom: 10px;
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  h3 {
    margin: 0;
    font-size: 15px;
  }
  .filebtn {
    font: inherit;
    font-weight: 700;
    min-height: 44px;
    padding: 0 14px;
    border-radius: 10px;
    border: 1px solid var(--line);
    background: var(--seg);
    color: var(--ink);
    cursor: pointer;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 6px;
    max-height: 260px;
    overflow-y: auto;
  }
  li button {
    font: inherit;
    width: 100%;
    display: flex;
    align-items: baseline;
    gap: 10px;
    min-height: 44px;
    padding: 0 12px;
    border-radius: 10px;
    border: 1px solid var(--line);
    background: var(--panel);
    color: var(--ink);
    cursor: pointer;
    text-align: left;
  }
  li span {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  li small {
    color: var(--muted);
    white-space: nowrap;
  }
  .note {
    margin: 0;
    color: var(--muted);
    font-size: 13px;
  }
  .note.warn {
    color: var(--warn-ink);
  }
</style>
