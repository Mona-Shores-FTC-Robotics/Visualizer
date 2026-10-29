import { serializeProject } from "../io";
import type { SharedLinks } from "../state/links.svelte";
import { encodeShareHash, shareUrl } from "../utils/shareLink";
import { showToast } from "../lib/toast";
import { exportAutoJava } from "../lib/auto/exportAction";
import type { Action, ActionDeps } from "./actions";

/** Fork: the Auto Builder's actions, in the palette and the top bar's menus. */
export function forkActions(
  { project, prefs, files, dialogs }: ActionDeps,
  links: SharedLinks,
): Action[] {
  return [
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
      run: () => (dialogs.github = true),
    },
    {
      id: "team.autos",
      group: "View",
      title: "Team Autos: the latest from biobuzz, together…",
      run: () => (dialogs.teamAutos = true),
    },
  ];
}
