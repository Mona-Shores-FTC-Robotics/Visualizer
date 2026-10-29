<script lang="ts">
  // Fork: a path end's link to the team's spots, as PathPlanner links waypoints
  // (lib/team/teamSpots.ts). Linked: the spot's name, its lock, and unlink. Not linked: pick a
  // team spot (the end jumps to it and stays on it), or name this end as a new team spot.
  import { Link2, Lock, LockOpen, Unlink } from "@lucide/svelte";
  import { useProject } from "../../state/project.svelte";
  import { useAuto } from "../../state/auto.svelte";
  import IconButton from "../components/ui/IconButton.svelte";
  import Button from "../components/ui/Button.svelte";
  import { fieldClass } from "../components/ui/styles";
  import { cleanSpotName } from "../simple/steps";
  import type { NamedPoint } from "../auto/types";
  import { linkSpot, unlinkSpot } from "./teamSpots";
  import {
    editSpot,
    setSpotUnlocked,
    spotEdits,
    teamSpots,
    unlockedSpots,
  } from "./spotsStore";

  interface Props {
    /** The path segment whose end this is. */
    lineId: string;
  }

  let { lineId }: Props = $props();

  const project = useProject();
  const auto = useAuto();

  let section = $derived(project.doc.auto);
  /** The named point the end sits on, if any. */
  let pinned = $derived(section?.pathEnds[lineId] ?? null);
  let linked = $derived(!!pinned && !!section?.teamSpots?.includes(pinned));
  let unlocked = $derived(!!pinned && $unlockedSpots.has(pinned));
  let changed = $derived(!!pinned && !!$spotEdits[pinned]);
  let names = $derived(Object.keys($teamSpots).sort());

  let open = $state(false);
  let newName = $state("");

  /** The end's pose now: its spot's, or where the path ends, facing as it ends. */
  function endPose(): NamedPoint | null {
    if (pinned && section?.points[pinned]) return section.points[pinned];
    const info = auto.catalog?.byId.get(lineId);
    if (!info) return null;
    const deg = ((Math.round(info.endHeadingDeg) % 360) + 360) % 360;
    return [
      Math.round(info.end.x * 10) / 10,
      Math.round(info.end.y * 10) / 10,
      deg,
    ];
  }

  function link(name: string) {
    const pose = $teamSpots[name];
    if (!pose) return;
    project.apply((doc) => linkSpot(doc, name, pose, lineId));
    open = false;
  }

  function makeTeamSpot() {
    const name = cleanSpotName(newName || pinned || "");
    const pose = endPose();
    if (!name || !pose) return;
    if (
      $teamSpots[name] &&
      !confirm(`${name} is already a team spot. Move it here?`)
    )
      return;
    editSpot(name, pose);
    project.apply((doc) => linkSpot(doc, name, pose, lineId));
    newName = "";
    open = false;
  }

  function unlink() {
    if (!pinned) return;
    const name = pinned;
    project.apply((doc) => unlinkSpot(doc, name));
  }
</script>

{#if section}
  <div class="flex flex-col gap-1.5 text-sm">
    {#if linked && pinned}
      <div class="flex items-center gap-1.5">
        <Link2 class="size-3.5 shrink-0 text-primary" />
        <span class="flex min-w-0 flex-1 flex-col leading-tight">
          <span class="truncate font-mono text-heading">{pinned}</span>
          <span class="text-xs text-body"
            >team spot{unlocked ? ", unlocked" : ", locked"}{changed
              ? " · changed, not saved"
              : ""}</span
          >
        </span>
        <IconButton
          label={unlocked
            ? "Lock this team spot"
            : "Unlock this team spot to move it (every Auto that uses it moves with it once saved)"}
          size="sm"
          active={unlocked}
          onclick={() => setSpotUnlocked(pinned!, !unlocked)}
        >
          {#if unlocked}<LockOpen />{:else}<Lock />{/if}
        </IconButton>
        <IconButton
          label="Unlink: this Auto keeps the spot as its own"
          size="sm"
          onclick={unlink}><Unlink /></IconButton
        >
      </div>
    {:else}
      <Button
        size="sm"
        variant="ghost"
        title="Link this end to one of the team's spots, or make it one"
        onclick={() => (open = !open)}
      >
        <Link2 class="size-3.5" />
        {pinned ? `${pinned}: link to team spots` : "Link to a team spot"}
      </Button>
      {#if open}
        <div class="flex flex-col gap-1.5 rounded-md border border-border p-2">
          {#if names.length}
            <span class="text-xs text-body">Put this end on a team spot:</span>
            <div class="flex flex-wrap gap-1">
              {#each names as name (name)}
                <button
                  type="button"
                  class="rounded border border-border px-1.5 py-0.5 font-mono text-xs text-heading hover:border-primary"
                  onclick={() => link(name)}>{name}</button
                >
              {/each}
            </div>
          {:else}
            <span class="text-xs text-body">The team has no spots yet.</span>
          {/if}
          <span class="text-xs text-body">Or make this end a team spot:</span>
          <div class="flex items-center gap-1.5">
            <input
              class={[fieldClass, "!py-0.5 font-mono text-xs"]}
              placeholder={pinned ?? "NAME"}
              aria-label="Team spot name"
              bind:value={newName}
              onkeydown={(e) => e.key === "Enter" && makeTeamSpot()}
            />
            <Button size="sm" onclick={makeTeamSpot}>Make team spot</Button>
          </div>
        </div>
      {/if}
    {/if}
  </div>
{/if}
