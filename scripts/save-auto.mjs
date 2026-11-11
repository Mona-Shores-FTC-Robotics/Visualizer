// Save a .pp into a biobuzz checkout the way the app's "Save to repo folder" does, without opening
// the app: the file is loaded, laid out (link paths) and written as the app writes it, with its
// generated Java beside it.
//   node scripts/save-auto.mjs path/to/source.pp path/to/biobuzz [autos subfolder: "", drafts, partners]
// The source may be a hand-assembled project (paths in any order, no link paths); the saved file
// is what the editor would save. The name saved under is the source file's.
import { createServer } from "vite";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

const [input, checkoutArg, sub = ""] = process.argv.slice(2);
if (!input || !checkoutArg) {
  console.error(
    "usage: node scripts/save-auto.mjs <file.pp> <biobuzz checkout> [drafts|partners]",
  );
  process.exit(2);
}
const checkout = resolve(checkoutArg);
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
  const load = (path) => server.ssrLoadModule(path);
  const { DEFAULT_SETTINGS } = await load("/src/config/index.ts");
  const { projectFromJson, robotConfigOf, serializeProject } =
    await load("/src/io/index.ts");
  const { layOutDoc } = await load("/src/lib/auto/links.ts");
  const { generateAutoJavaFromText } = await load(
    "/src/lib/codegen/auto/fromFile.ts",
  );
  const { GENERATED_DIRS, PP_DIRS, generatedPathFor } = await load(
    "/src/lib/sim/biobuzz.ts",
  );

  const name = basename(input);
  const data = JSON.parse(readFileSync(input, "utf8"));
  const loaded = projectFromJson(data, robotConfigOf(DEFAULT_SETTINGS));
  if (!loaded.ok) throw new Error(loaded.error);
  loaded.warnings.forEach((warning) => console.warn(`load: ${warning}`));
  const doc = layOutDoc(loaded.doc, {
    ...DEFAULT_SETTINGS,
    ...loaded.doc.robot,
  });
  const text = serializeProject(doc, { pretty: true });
  const ppPath = `${PP_DIRS[0]}${sub ? `/${sub}` : ""}/${name}`;
  const result = generateAutoJavaFromText(text, name);
  result.loadProblems.forEach((problem) => console.warn(`load: ${problem}`));
  result.warnings.forEach((warning) => console.warn(`warning: ${warning}`));
  if (!result.ok) {
    result.errors.forEach((error) => console.error(`error: ${error}`));
    code = 1;
  } else {
    const existing = GENERATED_DIRS.flatMap((dir) => {
      try {
        return readdirSync(join(checkout, dir)).map((file) => `${dir}/${file}`);
      } catch {
        return [];
      }
    });
    const javaPath = generatedPathFor(ppPath, result.fileName, existing);
    for (const [path, body] of [
      [ppPath, text],
      [javaPath, result.source],
    ]) {
      mkdirSync(dirname(join(checkout, path)), { recursive: true });
      writeFileSync(join(checkout, path), body);
      console.log(`wrote ${path}`);
    }
  }
} catch (error) {
  console.error(`error: ${error.message}`);
  code = 1;
} finally {
  await server.close();
}
process.exit(code);
