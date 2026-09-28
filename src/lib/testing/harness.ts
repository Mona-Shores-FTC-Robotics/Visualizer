/**
 * The smallest test harness that does the job: `test()` registers, the runner
 * in scripts/run-tests.mjs executes. No dependency beyond Vite, which the
 * project already has.
 */
type TestFn = () => void | Promise<void>;

let tests: { name: string; fn: TestFn }[] = [];

export function test(name: string, fn: TestFn): void {
  tests.push({ name, fn });
}

export function registeredTests(): { name: string; fn: TestFn }[] {
  return tests;
}

export function resetTests(): void {
  tests = [];
}

export function assert(condition: unknown, message = "assertion failed"): asserts condition {
  if (!condition) throw new Error(message);
}

export function assertEqual<T>(actual: T, expected: T, message = ""): void {
  const a = JSON.stringify(actual, null, 2);
  const e = JSON.stringify(expected, null, 2);
  if (a !== e) {
    throw new Error(`${message ? message + ": " : ""}expected\n${e}\nbut got\n${a}`);
  }
}

/** Compares two texts and reports the first differing line. */
export function assertText(actual: string, expected: string, message = ""): void {
  if (actual === expected) return;
  const a = actual.split("\n");
  const e = expected.split("\n");
  for (let i = 0; i < Math.max(a.length, e.length); i++) {
    if (a[i] !== e[i]) {
      throw new Error(
        `${message ? message + ": " : ""}line ${i + 1} differs\n  expected: ${JSON.stringify(e[i])}\n  actual:   ${JSON.stringify(a[i])}`,
      );
    }
  }
}
