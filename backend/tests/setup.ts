process.env.NODE_ENV = "test";
process.env.JWT_ACCESS_SECRET = "test-access-secret";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
process.env.ACCESS_TOKEN_TTL = "15m";
process.env.REFRESH_TOKEN_TTL = "30d";
process.env.ENCRYPTION_KEY = "kY0Lj3TfXQt86HGiBbx5xMVJUckyApqilR50okbOxfY=";
process.env.MONGODB_URI = "mongodb://placeholder/test"; // overridden below once the in-memory server is up
process.env.FRONTEND_URL = "http://localhost:5173";

// Prefer a locally installed mongod over downloading a binary — sandboxed/offline environments
// (and CI, if `mongodb-actions/setup-mongodb`-style installs are added later) may have no network
// access for mongodb-memory-server's own download step.
if (!process.env.MONGOMS_SYSTEM_BINARY) {
  const fs = await import("node:fs");
  const candidate = ["/opt/homebrew/bin/mongod", "/usr/local/bin/mongod", "/usr/bin/mongod"].find(
    (path) => fs.existsSync(path),
  );
  if (candidate) {
    process.env.MONGOMS_SYSTEM_BINARY = candidate;
  }
}

import { beforeAll, afterAll, afterEach } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    await collections[key]?.deleteMany({});
  }
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});
