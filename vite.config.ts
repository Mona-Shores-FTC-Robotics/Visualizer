/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { copyFileSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Fork: publishes samples/*.pp at samples/ on the site, for sample links
 * (#sample=<name>, see src/utils/sampleLink.ts); served the same way in dev.
 */
function samples(): Plugin {
  const dir = resolve(import.meta.dirname, "samples");
  const files = () => readdirSync(dir).filter((name) => name.endsWith(".pp"));
  return {
    name: "samples",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const match = /\/samples\/([a-z0-9-]+\.pp)$/.exec(
          (req.url ?? "").split("?")[0],
        );
        if (!match || !files().includes(match[1])) return next();
        res.setHeader("Content-Type", "application/json");
        res.end(readFileSync(resolve(dir, match[1])));
      });
    },
    writeBundle(options) {
      const out = resolve(options.dir ?? "dist", "samples");
      mkdirSync(out, { recursive: true });
      for (const name of files()) {
        copyFileSync(resolve(dir, name), resolve(out, name));
      }
    },
  };
}

export default defineConfig({
  plugins: [svelte(), samples()],
  server: {
    // Allow the sandboxed preview host used for live previews.
    host: "0.0.0.0",
    allowedHosts: true,
  },
  build: {
    outDir: "dist",
    // Fork: the pit tablets (Alcatel 9007T, Android 5.1.1) run Chrome 95 at best, older if never updated, so
    // syntax and CSS are written down for them; APIs they lack are in src/lib/oldBrowsers.ts.
    target: ["chrome85", "safari14", "firefox90"],
    cssTarget: ["chrome85", "safari14", "firefox90"],
    // Fork: partner.html is a page of its own (src/partner), beside the app.
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        partner: resolve(import.meta.dirname, "partner.html"),
        share: resolve(import.meta.dirname, "share.html"),
      },
    },
    // Increase chunk size warning limit to 1.2 MB to avoid noisy warnings
    chunkSizeWarningLimit: 1200,
  },
  base: "./",
  test: {
    include: ["test/**/*.test.ts", "src/**/*.test.ts"],
    setupFiles: ["test/support/setup.ts"],
  },
});
