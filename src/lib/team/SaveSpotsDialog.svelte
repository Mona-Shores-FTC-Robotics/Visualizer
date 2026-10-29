<script lang="ts">
  // Fork: "Save team spots" (lib/team/teamSpots.ts). One commit on a new branch of biobuzz:
  // spots.json with the changes made here, and every Auto in TeamCode/autos that uses a changed
  // spot, re-exported (.pp and Java). Then a pull request, since master changes only through
  // one; the changes here are dropped once master has them.
  import Modal from "../components/ui/Modal.svelte";
  import Button from "../components/ui/Button.svelte";
  import { fieldClass } from "../components/ui/styles";
  import {
    branchHead,
    commitFiles,
    createBranch,
    listFiles,
    pullRequestUrl,
    readText,
    savedToken,
    saveToken,
    whoAmI,
  } from "../github/api";
  import { changedSpots, teamSpotSave } from "./teamSpots";
  import { savedSpots, spotEdits } from "./spotsStore";

  interface Props {
    isOpen: boolean;
    onClose: () => void;
  }

  let { isOpen, onClose }: Props = $props();

  let token = $state<string | null>(savedToken());
  // The token "GitHub…" saved, read each time this opens: it may have been set up since.
  $effect(() => {
    if (isOpen) token = savedToken();
  });
  let tokenInput = $state("");
  let saving = $state(false);
  let problems = $state<string[]>([]);
  let done = $state<{ url: string; autos: string[] } | null>(null);

  let names = $derived(
    changedSpots($savedSpots, { ...$savedSpots, ...$spotEdits }),
  );

  async function useToken() {
    const t = tokenInput.trim();
    if (!t) return;
    try {
      await whoAmI(t);
      saveToken(t);
      token = t;
      tokenInput = "";
      problems = [];
    } catch (error) {
      problems = [(error as Error).message];
    }
  }

  async function save() {
    if (!token) return;
    saving = true;
    problems = [];
    try {
      const head = await branchHead(token, "master");
      const paths = await listFiles(token, head);
      const plan = await teamSpotSave(
        (path) => readText(token, path, head),
        paths,
        $spotEdits,
      );
      if (!plan.ok) {
        problems = plan.errors;
        return;
      }
      const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
      const branch = `spots/${stamp}`;
      await createBranch(token, branch, head);
      const title = `Team spots: ${names.join(", ")}`;
      const autos = plan.autos.length
        ? `\n\nRe-exported, .pp and Java: ${plan.autos.join(", ")}.`
        : "\n\nNo Auto uses these spots yet.";
      await commitFiles(
        token,
        branch,
        head,
        plan.files,
        `${title}${autos}\n\nSaved from the Visualizer's team spots.`,
      );
      done = { url: pullRequestUrl(branch, title), autos: plan.autos };
    } catch (error) {
      problems = [(error as Error).message];
    } finally {
      saving = false;
    }
  }

  function close() {
    done = null;
    problems = [];
    onClose();
  }
</script>

<Modal {isOpen} onClose={close} titleId="save-spots-title">
  <div class="flex max-w-lg flex-col gap-3 p-4 text-sm text-heading">
    <h2 id="save-spots-title" class="text-xl font-semibold text-heading">
      Save team spots
    </h2>
    {#if done}
      <p>
        Saved on a new branch{done.autos.length
          ? `, with ${done.autos.join(", ")} re-exported`
          : ""}. Open the pull request; once it is merged, every Auto and the
        robot code use the new spots.
      </p>
      <a class="underline" href={done.url} target="_blank" rel="noreferrer"
        >Open the pull request on GitHub</a
      >
      <div class="flex justify-end">
        <Button onclick={close}>Done</Button>
      </div>
    {:else}
      <p>
        Changed here: <b class="font-mono">{names.join(", ") || "nothing"}</b>.
        Saving writes the team's list and re-exports every Auto in biobuzz that
        uses one of them, so the robot code changes with it. It goes on a new
        branch with a pull request; master changes when that is merged.
      </p>
      {#if token}
        <div class="flex justify-end gap-2">
          <Button variant="ghost" onclick={close}>Cancel</Button>
          <Button
            variant="primary"
            disabled={saving || !names.length}
            onclick={save}>{saving ? "Saving…" : "Save to biobuzz"}</Button
          >
        </div>
      {:else}
        <p class="text-xs text-body">
          Saving needs the GitHub token that "GitHub…" (Save to GitHub) uses: a
          fine-grained token for biobuzz with Contents: Read and write. Paste it
          here, or set it up there first.
        </p>
        <div class="flex gap-2">
          <input
            type="password"
            class={[fieldClass, "flex-1"]}
            placeholder="github_pat_…"
            bind:value={tokenInput}
            onkeydown={(e) => e.key === "Enter" && useToken()}
          />
          <Button onclick={useToken}>Use token</Button>
        </div>
      {/if}
    {/if}
    {#each problems as problem (problem)}
      <p class="text-xs text-danger">{problem}</p>
    {/each}
  </div>
</Modal>
