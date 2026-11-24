// Runs the scripted trials in scripts/*.trial.ts (not part of CI's test run):
//   npx vitest run -c scripts/vitest.trial.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["scripts/*.trial.ts"],
    testTimeout: 1_800_000,
  },
});
