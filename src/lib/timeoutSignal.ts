/**
 * An abort signal that fires after `ms`, like `AbortSignal.timeout`, which older tablets and phones
 * (Safari before 16, Chrome before 103) lack: calling it there throws before the fetch even starts.
 * The abort reason is a "TimeoutError" DOMException either way.
 */
export function timeoutSignal(ms: number): AbortSignal {
  if (typeof AbortSignal.timeout === "function") return AbortSignal.timeout(ms);
  const controller = new AbortController();
  setTimeout(
    () => controller.abort(new DOMException("Timed out", "TimeoutError")),
    ms,
  );
  return controller.signal;
}
