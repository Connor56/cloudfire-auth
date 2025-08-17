import type { DecodedIdToken } from "../types.js";

/**
 * Verifies a Firebase ID token (JWT). If the token is valid, the promise is
 * fulfilled with the token's decoded claims; otherwise, the promise is
 * rejected.
 *
 * If `checkRevoked` is set to true, first verifies whether the corresponding
 * user is disabled. If yes, an `auth/user-disabled` error is thrown. If no,
 * verifies if the session corresponding to the ID token was revoked. If the
 * corresponding user's session was invalidated, an `auth/id-token-revoked`
 * error is thrown. If not specified the check is not applied.
 *
 * See {@link https://firebase.google.com/docs/auth/admin/verify-id-tokens | Verify ID Tokens}
 * for code samples and detailed documentation.
 *
 * @param idToken - The ID token to verify.
 * @param checkRevoked - Whether to check if the ID token was revoked.
 *   This requires an extra request to the Firebase Auth backend to check
 *   the `tokensValidAfterTime` time for the corresponding user.
 *   When not specified, this additional check is not applied.
 *
 * @returns A promise fulfilled with the
 *   token's decoded claims if the ID token is valid; otherwise, a rejected
 *   promise.
 */
export async function verifyIdTokenHandler(
  idToken: string,
  oauth2Token: string
  checkRevoked?: boolean,
): Promise<DecodedIdToken> {
  throw new Error("Not implemented");
}
