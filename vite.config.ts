import { defineConfig, type Plugin } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { copyFileSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { biobuzzBridge } from "./vite/biobuzzBridge";

/**
 * Publishes samples/*.pp at samples/ on the site, for sample links
 * (#sample=<name>, see src/utils/sampleLink.ts); served the same way in dev.
 */
function samples(): Plugin {
  const dir = resolve(__dirname, "samples");
  const files = () => readdirSync(dir).filter((name) => name.endsWith(".pp"));
  return {
    name: "samples",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const match = /\/samples\/([a-z0-9-]+\.pp)$/.exec((req.url ?? "").split("?")[0]);
        if (!match || !files().includes(match[1])) return next();
        res.setHeader("Content-Type", "application/json");
        res.end(readFileSync(resolve(dir, match[1])));
      });
    },
    writeBundle(options) {
      const out = resolve(options.dir ?? "dist", "samples");
      mkdirSync(out, { recursive: true });
      for (const name of files()) copyFileSync(resolve(dir, name), resolve(out, name));
    },
  };
}

export default defineConfig({
  plugins: [svelte(), samples(), biobuzzBridge()],
  server: {
    // Allow the sandboxed preview host used for live previews.
    host: "0.0.0.0",
    allowedHosts: true,
  },
  build: {
    outDir: "dist",
    // Increase chunk size warning limit to 1.2 MB to avoid noisy warnings
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        entryFileNames: `assets/[name].js`,
        chunkFileNames: `assets/[name].js`,
        assetFileNames: `assets/[name].[ext]`,
      },
    },
  },
  base: "./",
});
