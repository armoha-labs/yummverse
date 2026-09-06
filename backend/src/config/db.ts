import mongoose from "mongoose";
import { env } from "./env.js";
import { logger } from "./logger.js";

export async function connectDb(uri: string = env.MONGODB_URI): Promise<typeof mongoose> {
  mongoose.set("strictQuery", true);
  const connection = await mongoose.connect(uri);
  logger.info({ host: connection.connection.host }, "Connected to MongoDB");
  return connection;
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
}
