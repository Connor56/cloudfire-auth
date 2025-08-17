import type { UserRecord } from "../types.js";

export async function getUserByProviderUidHandler(providerId: string, uid: string): Promise<UserRecord> {
  throw new Error("Not implemented");
}
