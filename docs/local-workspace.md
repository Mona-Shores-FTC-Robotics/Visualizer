# Working on Belding autos

Before the event, make the Belding branch from the stable revision in Android Studio and keep
that BIOBUZZ checkout on Belding. Use the same folder in Visualizer and Android Studio. The
Visualizer never switches Git branches or runs Sloth Load for you.

1. Open **Workspace**, choose the folder containing `TeamCode`, choose an auto and optionally
   a partner, then **Open auto**. The header shows the checkout, branch when available, auto,
   and whether it is saved there.
2. Edit normally. The candidate shown beside the partner is the same document as the editor.
   Partners are read-only references from this checkout. **Update partner only** changes the
   comparison without reopening or losing your candidate edits.
   To change the stand-in itself, use **Edit selected partner**; its name and destination
   become the active file, and Save regenerates its Java in this checkout too.
3. **Save** or Ctrl+S writes the candidate's `.pp` and generates its Java in this checkout.
   Changed shared spots are saved there too, with every linked auto re-exported. A save does
   not commit, push, open a PR, run CI, or deploy. Run Sloth Load yourself.
4. After testing the saved candidate on the robot, open Workspace, name the checkpoint and
   press **Mark saved auto tested**. This is your declaration that you tested it, not something
   the browser infers from a successful save.
5. **Restore** preserves the current experiment first, then restores the checkpoint's auto
   sources, generated Java, Auto OpMode wrappers, spots, registry and timing together. This is
   a checkpoint of the auto workspace: other autos from that checkpoint are restored too,
   because their shared spots must stay consistent. Unrelated robot code is untouched.

Checkpoints live in `TeamCode/.auto-workspace/checkpoints/` on this laptop, independently of
browser storage. They are ignored by Git. Commit and push the actual working sources on
Belding when you want a shared backup. After the event, bring the successful changes into
master through the normal PR/check process. CI can run in the background when you push; it
does not block this local loop.

To start a new candidate, use New project, then **Save to repo folder…** with its own filename.
That explicitly chooses the save destination; later saves go there directly. `drafts/name.pp`
remains a simulator draft. Saving a new generated class does not create its selectable
`BuiltAuto` OpMode; prepare that before testing a new auto on the robot.

Files opened from GitHub or browser storage are still identified as references/browser copies.
They do not silently become checkout files. Import one deliberately with Save to repo folder.
Once a checkout is connected, the Team Autos button opens that local workspace. Shared spots
and timing come from the checkout even when GitHub is reachable; browser spot/timing edits are
scoped to that checkout and branch.

If another editor changes auto files on disk, Save refuses to overwrite them. Keep the editor
changes, inspect the disk version and reopen deliberately. Switching the checkout or its Git
branch also requires reopening. For a Git worktree whose `.git` is an external pointer, the
browser may not be able to read the branch; the header says **branch unavailable**, so confirm
it in Android Studio. Browsers require Chrome/Edge folder access; reconnect/allow it if asked.

Interrupted multi-file saves retain an undo journal. Reopening the workspace recovers the
previous files before editing continues. Keep this folder outside cloud-sync tools that edit
files concurrently; the browser cannot lock out Android Studio or other applications.

The field preview and partner what-ifs run locally. For detailed Java simulation and matching
AdvantageScope logs without GitHub, use BIOBUZZ's `tools/simulate-auto/simulate_auto.py` on the
saved checkout. GitHub Save and Simulate remains an explicit publishing action; it is not part
of Save. Load the Visualizer and AdvantageScope field/model assets before going offline.
