// Minimal test runner: loads every src/**/*.test.ts through Vite (so the
// TypeScript and module resolution match the app) and runs what they register
// with src/lib/testing/harness.ts. Usage: node scripts/run-tests.mjs [filter]
import { createServer } from "vite";
import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const filter = process.argv[2] ?? "";

function findTests(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...findTests(path));
    else if (name.endsWith(".test.ts")) out.push(path);
  }
  return out;
}

const server = await createServer({
  configFile: false,
  root,
  logLevel: "error",
  appType: "custom",
  server: { middlewareMode: true, hmr: false, ws: false },
  optimizeDeps: { noDiscovery: true, include: [] },
});

let failed = 0;
let passed = 0;
try {
  const harness = await server.ssrLoadModule("/src/lib/testing/harness.ts");
  for (const file of findTests(join(root, "src"))) {
    const id = "/" + relative(root, file).split("\\").join("/");
    if (filter && !id.includes(filter)) continue;
    harness.resetTests();
    await server.ssrLoadModule(id);
    for (const { name, fn } of harness.registeredTests()) {
      try {
        await fn();
        passed++;
        console.log(`  ok   ${id} › ${name}`);
      } catch (error) {
        failed++;
        console.log(`  FAIL ${id} › ${name}\n       ${String(error?.stack ?? error).split("\n").join("\n       ")}`);
      }
    }
  }
} finally {
  await server.close();
}
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
