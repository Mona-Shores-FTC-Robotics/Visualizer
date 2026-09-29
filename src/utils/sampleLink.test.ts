import { assertEqual, test } from "../lib/testing/harness";
import { resolveProjectHash } from "./sampleLink";

const files: Record<string, string> = {
  "red-garden-basic.pp": JSON.stringify({ lines: [], startPoint: { x: 60, y: 9 } }),
  "broken.pp": "{ not json",
};
const load = async (name: string) => files[name] ?? null;

test("sample link: opens the named sample as a shared copy", async () => {
  const result = await resolveProjectHash("#sample=red-garden-basic", load);
  assertEqual(result.kind, "ok");
  if (result.kind === "ok") assertEqual(result.shared.name, "red-garden-basic.pp");
});

test("sample link: unknown, unreadable and unsafe names say so", async () => {
  assertEqual((await resolveProjectHash("#sample=nope", load)).kind, "error");
  assertEqual((await resolveProjectHash("#sample=broken", load)).kind, "error");
  assertEqual((await resolveProjectHash("#sample=../secrets", load)).kind, "error");
});

test("sample link: other fragments are left to the share-link reader", async () => {
  assertEqual((await resolveProjectHash("", load)).kind, "none");
  assertEqual((await resolveProjectHash("#export-gif-test", load)).kind, "none");
});
