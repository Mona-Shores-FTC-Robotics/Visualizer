import type { SimResult } from "./biobuzz";

/**
 * The browser's side of the dev server's biobuzz bridge (vite/biobuzzBridge.ts).
 * On the hosted site there is no bridge: `bridgeStatus` answers null and the
 * Simulator button stays hidden.
 */

export interface BridgeStatus {
  ok: boolean;
  dir: string;
  branch?: string | null;
  running?: string | null;
  canRun?: boolean;
  reason?: string;
}

export interface BridgeFile {
  path: string;
  autoClass: string | null;
}

export interface RunStarted {
  id: string;
  spec: string;
  javaFile: string;
  warnings: string[];
}

export interface RunStatus {
  id: string;
  spec: string;
  ppPath: string;
  javaFile: string;
  folder: string;
  state: "running" | "done" | "failed";
  seconds: number;
  output: string[];
  result: SimResult | null;
}

export interface RunOptions {
  path: string;
  text: string;
  partner: string | null;
  design: string;
  partnerDesign: string | null;
  partnerSpeed: number | null;
  speed: number;
  seeds: number;
  alliance: "RED" | "BLUE";
}

const BASE = "/__biobuzz";
const HEADERS = { "X-Biobuzz": "1" };

/** An error from the bridge, with the exporter's own messages when it blocked. */
export class BridgeError extends Error {
  constructor(
    message: string,
    readonly details: string[] = [],
  ) {
    super(message);
  }
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { ...HEADERS, ...(init.headers ?? {}) },
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new BridgeError(
      data.error ?? `The bridge answered ${response.status}`,
      data.errors ?? [],
    );
  return data as T;
}

/** The bridge's state, or null where there is none (the hosted site, `vite preview`). */
export async function bridgeStatus(): Promise<BridgeStatus | null> {
  if (!import.meta.env.DEV) return null;
  try {
    const response = await fetch(`${BASE}/status`, { cache: "no-store" });
    if (!response.ok) return null;
    return (await response.json()) as BridgeStatus;
  } catch {
    return null;
  }
}

export async function listFiles(): Promise<BridgeFile[]> {
  return (await call<{ files: BridgeFile[] }>("/files")).files;
}

export async function readFile(path: string): Promise<string> {
  return (
    await call<{ text: string }>(`/file?path=${encodeURIComponent(path)}`)
  ).text;
}

export function startRun(options: RunOptions): Promise<RunStarted> {
  return call<RunStarted>("/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(options),
  });
}

export function runStatus(id: string): Promise<RunStatus> {
  return call<RunStatus>(`/run?id=${encodeURIComponent(id)}`);
}

/** Downloads one seed's .wpilog (the bridge names the file). */
export async function downloadLog(id: string, file: string): Promise<void> {
  const response = await fetch(
    `${BASE}/log?id=${encodeURIComponent(id)}&file=${encodeURIComponent(file)}`,
    {
      headers: HEADERS,
    },
  );
  if (!response.ok) throw new BridgeError(`Could not download ${file}`);
  const name =
    /filename="([^"]+)"/.exec(
      response.headers.get("Content-Disposition") ?? "",
    )?.[1] ?? file;
  const url = URL.createObjectURL(await response.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
