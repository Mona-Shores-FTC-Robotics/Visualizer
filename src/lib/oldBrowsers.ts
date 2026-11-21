/**
 * What the partner page needs that old Android tablets' browsers (Chrome before 98) lack. Imported
 * first, so it is in place before Svelte, which copies state with `structuredClone`, starts.
 * The copy covers what the page keeps: plain objects, arrays, dates, maps and sets.
 */
function copy(value: unknown, seen: Map<object, unknown>): unknown {
  if (typeof value !== "object" || value === null) return value;
  if (seen.has(value)) return seen.get(value);
  if (value instanceof Date) return new Date(value.getTime());
  if (value instanceof Map) {
    const out = new Map();
    seen.set(value, out);
    for (const [k, v] of value) out.set(copy(k, seen), copy(v, seen));
    return out;
  }
  if (value instanceof Set) {
    const out = new Set();
    seen.set(value, out);
    for (const v of value) out.add(copy(v, seen));
    return out;
  }
  const out: Record<string, unknown> | unknown[] = Array.isArray(value)
    ? []
    : {};
  seen.set(value, out);
  for (const key of Object.keys(value))
    (out as Record<string, unknown>)[key] = copy(
      (value as Record<string, unknown>)[key],
      seen,
    );
  return out;
}

export function structuredCopy<T>(value: T): T {
  return copy(value, new Map()) as T;
}

if (typeof globalThis.structuredClone !== "function")
  (globalThis as { structuredClone: unknown }).structuredClone = structuredCopy;
