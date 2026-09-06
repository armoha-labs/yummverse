import { Schema, model } from "mongoose";

// Backs atomic sequence generation (order numbers, §24) — _id is a composite key
// like "{tenantId}:{branchId}".
const counterSchema = new Schema({
  _id: { type: String, required: true },
  seq: { type: Number, required: true, default: 1000 },
});

export const Counter = model("Counter", counterSchema);

export async function nextSequence(key: string): Promise<number> {
  const result = await Counter.findByIdAndUpdate(
    key,
    { $inc: { seq: 1 } },
    { upsert: true, new: true },
  );
  return result.seq;
}
