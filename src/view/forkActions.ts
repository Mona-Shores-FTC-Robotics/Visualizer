import { serializeProject } from "../io";
import type { SharedLinks } from "../state/links.svelte";
import { encodeShareHash, shareUrl } from "../utils/shareLink";
import { showToast } from "../lib/toast";
import { exportAutoJava } from "../lib/auto/exportAction";
import type { Action, ActionDeps } from "./actions";
import { get } from "svelte/store";
import { repoFolder } from "../lib/repo/repoStore";
import { workspaceDocument } from "../lib/repo/workspaceStore";

/** Fork: the Auto Builder's actions, in the palette and the top bar's menus. */
export function forkActions(
  { project, prefs, files, dialogs }: ActionDeps,
  links: SharedLinks,
): Action[] {
  return [
    {
      id: "repo.workspace",
      group: "File",
      title: "Local auto workspace…",
      run: () => (dialogs.workspace = true),
    },
    {
      id: "export.auto",
      group: "Export",
      title: "Export Auto (Java)",
      when: () => Boolean(project.doc.auto),
      run: () => {
        const { startPoint, lines, shapes } = project.doc;
        exportAutoJava({
          startPoint,
          lines,
          shapes,
          settings: prefs.settings,
          sourceFileName: links.sourceName ?? "untitled.pp",
        });
      },
    },
    {
      id: "export.shareLink",
      group: "Export",
      title: "Share link",
      run: async () => {
        // The project as it would be saved, without the files shown beside it.
        const { activePaths: _shown, ...project } = JSON.parse(
          serializeProject(files.current()),
        );
        try {
          const hash = await encodeShareHash({
            name: links.sourceName,
            project,
          });
          dialogs.shareLink = shareUrl(hash, window.location);
        } catch (error) {
          console.error("Share link failed:", error);
          showToast("This browser cannot make share links.", "error");
        }
      },
    },
    {
      id: "github.save",
      group: "File",
      title: "Save to GitHub and simulate…",
      run: async () => {
        if (get(workspaceDocument) && !(await files.saveWorkspace())) return;
        if (
          get(workspaceDocument) &&
          (!get(repoFolder)?.branch ||
            get(repoFolder)?.branch?.startsWith("detached "))
        ) {
          showToast(
            "This checkout's Git branch is unavailable. Commit and push the saved files from Android Studio instead of publishing to a guessed branch.",
            "warning",
          );
          return;
        }
        dialogs.github = true;
      },
    },
    {
      id: "repo.save",
      group: "File",
      title: "Save to repo folder…",
      run: () => (dialogs.repo = true),
    },
    {
      id: "team.autos",
      group: "View",
      title: "Team Autos: the latest from biobuzz, together…",
      run: () => {
        if (get(repoFolder)) dialogs.workspace = true;
        else dialogs.teamAutos = true;
      },
    },
  ];
}
