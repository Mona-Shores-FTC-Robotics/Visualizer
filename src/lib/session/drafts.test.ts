import { assert, assertEqual, test } from "../testing/harness";
import {
  deleteDraft,
  draftKey,
  draftStatus,
  loadDraft,
  projectFingerprint,
  saveDraft,
  type DraftStorage,
} from "./drafts";

function memory(): DraftStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

const path = "TeamCode/autos/recycle5-left.pp";

test("one draft per branch and file, kept until deleted", () => {
  const storage = memory();
  assertEqual(loadDraft("claude/simulator", path, storage), null);
  const draft = { ref: "claude/simulator", path, text: "{edited}", baseText: "{github}", baseFingerprint: "{github}", editedAt: 1 };
  assert(saveDraft(draft, storage));
  assertEqual(loadDraft("claude/simulator", path, storage), draft);
  // The same file on another branch is another draft.
  assertEqual(loadDraft("master", path, storage), null);
  saveDraft({ ...draft, ref: null, text: "{other}" }, storage);
  assertEqual(loadDraft(null, path, storage)?.text, "{other}");
  assertEqual(loadDraft("claude/simulator", path, storage)?.text, "{edited}");
  deleteDraft("claude/simulator", path, storage);
  assertEqual(loadDraft("claude/simulator", path, storage), null);
  assertEqual(loadDraft(null, path, storage)?.text, "{other}");
  assert(draftKey(null, path) !== draftKey("claude/simulator", path));
});

test("damaged or missing storage loses drafts, never the page", () => {
  const storage = memory();
  storage.data.set("biobuzzDrafts", "{not json");
  assertEqual(loadDraft("x", path, storage), null);
  assert(saveDraft({ ref: "x", path, text: "a", baseText: "b", baseFingerprint: "b", editedAt: 1 }, storage));
  const full: DraftStorage = {
    getItem: () => null,
    setItem: () => {
      throw new Error("QuotaExceededError");
    },
  };
  assert(!saveDraft({ ref: "x", path, text: "a", baseText: "b", baseFingerprint: "b", editedAt: 1 }, full));
  assert(!saveDraft({ ref: "x", path, text: "a", baseText: "b", baseFingerprint: "b", editedAt: 1 }, null));
  assertEqual(loadDraft("x", path, null), null);
});

test("the bar says whether the draft is edited and whether GitHub moved on", () => {
  assertEqual(draftStatus(false, "v1", "v1"), "same");
  assertEqual(draftStatus(false, "v1", null), "same");
  assertEqual(draftStatus(true, "v1", "v1"), "edited");
  assertEqual(draftStatus(false, "v1", "v2"), "newer-on-github");
  assertEqual(draftStatus(true, "v1", "v2"), "edited-and-newer");
});

test("saving time, display settings and files shown beside it are not edits", () => {
  const project = { startPoint: { x: 1 }, lines: [], timestamp: "2026-10-03T12:00:00Z", activePaths: ["a.pp"] };
  const a = projectFingerprint({ ...project, settings: { rWidth: 18, leftPanelWidth: 300 } }, { rWidth: 18 });
  const b = projectFingerprint(
    { ...project, timestamp: "2026-10-04T09:00:00Z", activePaths: [], settings: { rWidth: 18, leftPanelWidth: 500 } },
    { rWidth: 18 },
  );
  assertEqual(a, b);
  assert(a !== projectFingerprint({ ...project, startPoint: { x: 2 } }, { rWidth: 18 }), "a moved start is an edit");
  assert(a !== projectFingerprint(project, { rWidth: 20 }), "a wider robot is an edit");
});
