import type { DecodedIdToken } from "../types.js";

export async function verifyIdTokenHandler(idToken: string, checkRevoked?: boolean): Promise<DecodedIdToken> {
  throw new Error("Not implemented");
}
