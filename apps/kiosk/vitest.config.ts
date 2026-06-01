import { defineConfig } from "vitest/config";

// Unit tests for the kiosk's pure logic (voice state machine, intent
// matchers). DOM/React behaviour is verified by `npx tsc --noEmit` + manual
// runs; these tests cover the concurrency-critical reducer in isolation, so
// the node environment is sufficient.
export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
    testTimeout: 10000,
  },
});
