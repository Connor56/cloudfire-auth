import type { SessionCookieOptions } from "../types.js";

/**
 * Creates a new Firebase session cookie from an ID token.
 *
 * The session cookie can be used for server-side session management. It has the same
 * payload claims as the provided ID token.
 *
 * @param idToken - The Firebase ID token to exchange for a session cookie
 * @param sessionCookieOptions - Options including custom session duration
 * @param oauth2AccessToken - OAuth2 access token for Firebase Admin API
 * @returns Promise that resolves to the session cookie string
 *
 * @throws {Error} Not yet implemented
 *
 * @package
 * @internal
 */
export async function createSessionCookieHandler(
  idToken: string,
  sessionCookieOptions: SessionCookieOptions,
  oauth2AccessToken: string
): Promise<string> {
  throw new Error("Not implemented");
}
