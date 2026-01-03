import type { ActionCodeSettings } from "../types.js";

/**
 * Generates an out-of-band email action link to verify a user's email ownership.
 *
 * The link can be sent to users to verify their email address. The optional
 * ActionCodeSettings object defines mobile app handling and additional state.
 *
 * @param email - The email account to verify
 * @param actionCodeSettings - Optional action code settings
 * @param oauth2AccessToken - OAuth2 access token for Firebase Admin API
 * @returns Promise that resolves to the generated link
 *
 * @throws {Error} Not yet implemented
 *
 * @package
 * @internal
 */
export async function generateEmailVerificationLinkHandler(
  email: string,
  actionCodeSettings: ActionCodeSettings | undefined,
  oauth2AccessToken: string
): Promise<string> {
  throw new Error("Not implemented");
}
