import { writable } from "svelte/store";

interface BaseRequest {
  title: string;
  message?: string;
  confirmLabel?: string;
}

export interface ConfirmRequest extends BaseRequest {
  kind: "confirm";
  /** Styles the confirm button as destructive. */
  danger?: boolean;
  resolve: (confirmed: boolean) => void;
}

export interface PromptRequest extends BaseRequest {
  kind: "prompt";
  value: string;
  placeholder?: string;
  /** Shown under the field, e.g. what gets added to the name. */
  hint?: string;
  /** A reason the value can't be used, or null when it can. */
  validate?: (value: string) => string | null;
  resolve: (value: string | null) => void;
}

/** One answer to a choice: its button, and a line under it saying what it does. */
export interface Choice {
  id: string;
  label: string;
  hint?: string;
}

export interface ChoiceRequest extends BaseRequest {
  kind: "choice";
  choices: Choice[];
  resolve: (id: string | null) => void;
}

export type DialogRequest = ConfirmRequest | PromptRequest | ChoiceRequest;

/** The open confirm or prompt dialog; the host renders it. */
export const dialogRequest = writable<DialogRequest | null>(null);

/** Ask a yes/no question. Resolves false if dismissed. */
export function confirmDialog(
  options: Omit<ConfirmRequest, "kind" | "resolve">,
): Promise<boolean> {
  return new Promise((resolve) =>
    dialogRequest.set({ ...options, kind: "confirm", resolve }),
  );
}

/** Ask for a line of text. Resolves to the trimmed value, or null if dismissed. */
export function promptDialog(
  options: Omit<PromptRequest, "kind" | "resolve" | "value"> & {
    value?: string;
  },
): Promise<string | null> {
  return new Promise((resolve) =>
    dialogRequest.set({ value: "", ...options, kind: "prompt", resolve }),
  );
}

/** Ask which of a few answers: resolves to the chosen one's id, or null if dismissed. */
export function choiceDialog(
  options: Omit<ChoiceRequest, "kind" | "resolve">,
): Promise<string | null> {
  return new Promise((resolve) =>
    dialogRequest.set({ ...options, kind: "choice", resolve }),
  );
}
