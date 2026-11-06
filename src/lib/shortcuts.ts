/**
 * A key combination such as `"mod+shift+z"`. `mod` is Cmd or Ctrl; the last
 * part is a key name as in `KeyboardEvent.key`, or `space`.
 */
export type KeySpec = string;

export interface Shortcut {
  /** Save can commit a coordinate field without requiring a click elsewhere. */
  allowWhileTyping?: boolean;
  keys?: KeySpec[];
  /** The shortcut is ignored while this returns false. */
  when?: () => boolean;
  run: () => void;
}

function matches(event: KeyboardEvent, spec: KeySpec): boolean {
  const parts = spec.toLowerCase().split("+");
  const key = parts.pop();
  const wantsMod = parts.includes("mod");
  const wantsCtrl = parts.includes("ctrl");
  const wantsShift = parts.includes("shift");

  const hasMod = event.metaKey || event.ctrlKey;
  if (wantsCtrl ? !event.ctrlKey : wantsMod !== hasMod) return false;
  if (!wantsMod && !wantsCtrl && hasMod) return false;
  if (wantsShift !== event.shiftKey) return false;
  if (event.altKey) return false;

  return key === "space"
    ? event.code === "Space"
    : event.key.toLowerCase() === key;
}

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
  );
}

/** Listen for every shortcut with one handler; returns the cleanup. */
export function installShortcuts(shortcuts: Shortcut[]): () => void {
  const onKeyDown = (event: KeyboardEvent) => {
    const typing = isTyping(event.target);
    const shortcut = shortcuts.find(
      ({ keys, when, allowWhileTyping }) =>
        (!typing || allowWhileTyping) &&
        keys?.some((spec) => matches(event, spec)) &&
        (when?.() ?? true),
    );
    if (!shortcut) return;
    event.preventDefault();
    // onchange-based numeric editors must commit before the save serializes the project.
    if (typing && event.target instanceof HTMLElement) event.target.blur();
    shortcut.run();
  };
  document.addEventListener("keydown", onKeyDown);
  return () => document.removeEventListener("keydown", onKeyDown);
}

const isMac =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad/.test(navigator.platform);

const KEY_LABELS: Record<string, string> = {
  mod: isMac ? "⌘" : "Ctrl",
  ctrl: isMac ? "⌃" : "Ctrl",
  shift: isMac ? "⇧" : "Shift",
  space: "Space",
  delete: "Del",
  escape: "Esc",
};

/** How a key spec reads in menus, e.g. `⌘⇧Z` or `Ctrl+Shift+Z`. */
export function formatKeys(spec: KeySpec): string {
  const labels = spec
    .split("+")
    .map((part) => KEY_LABELS[part.toLowerCase()] ?? part.toUpperCase());
  return labels.join(isMac ? "" : "+");
}
