// Export a .pp file's Auto as Java without opening the app:
//   node scripts/export-auto.mjs path/to/hive-rush.pp [outDir]
// Writes <ClassName>.java into outDir (default: next to the .pp file).
import { createServer } from "vite";
import { readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

const [input, outDirArg] = process.argv.slice(2);
if (!input) {
  console.error("usage: node scripts/export-auto.mjs <file.pp> [outDir]");
  process.exit(2);
}
const server = await createServer({
  configFile: false,
  root: process.cwd(),
  logLevel: "error",
  appType: "custom",
  server: { middlewareMode: true, hmr: false, ws: false },
  optimizeDeps: { noDiscovery: true, include: [] },
});
let code = 0;
try {
  const { generateAutoJavaFromText } = await server.ssrLoadModule(
    "/src/lib/codegen/auto/fromFile.ts",
  );
  const result = generateAutoJavaFromText(readFileSync(input, "utf8"), basename(input));
  result.loadProblems.forEach((problem) => console.warn(`load: ${problem}`));
  result.warnings.forEach((warning) => console.warn(`warning: ${warning}`));
  if (!result.ok) {
    result.errors.forEach((error) => console.error(`error: ${error}`));
    code = 1;
  } else {
    const out = join(resolve(outDirArg ?? dirname(input)), result.fileName);
    writeFileSync(out, result.source);
    console.log(`wrote ${out}`);
  }
} finally {
  await server.close();
}
process.exit(code);
