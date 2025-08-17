import type { UserIdentifier, GetUsersResult } from "../types.js";

export async function getUsersHandler(identifiers: UserIdentifier[]): Promise<GetUsersResult> {
  throw new Error("Not implemented");
}
