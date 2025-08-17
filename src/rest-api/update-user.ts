import type { UpdateRequest, UserRecord } from "../types.js";

export async function updateUserHandler(uid: string, properties: UpdateRequest): Promise<UserRecord> {
  throw new Error("Not implemented");
}
