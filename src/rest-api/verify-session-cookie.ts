import type { DecodedIdToken } from "../types.js";

export async function verifySessionCookieHandler(
  sessionCookie: string,
  checkRevoked?: boolean
): Promise<DecodedIdToken> {
  throw new Error("Not implemented");
}
