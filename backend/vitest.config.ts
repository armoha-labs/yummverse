import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    setupFiles: ["./tests/setup.ts"],
    testTimeout: 30000,
    hookTimeout: 120000,
    // Mongoose keeps a global default-connection singleton; under thread-pool parallelism
    // multiple test files can share a worker thread and stomp on each other's connection,
    // causing intermittent cross-file flakiness. Process-based isolation avoids that.
    pool: "forks",
    // Each test file spins up its own mongod. Running every file fully in parallel spawns
    // a dozen+ concurrent instances, which is enough resource contention in constrained
    // environments to cause intermittent, unrelated-looking failures. Sequential file
    // execution trades a few seconds of wall-clock time for full reliability.
    fileParallelism: false,
  },
});
