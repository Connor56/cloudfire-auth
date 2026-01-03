import type { ActionCodeSettings } from "../types.js";

/**
 * Generates an out-of-band email action link to reset a user's password.
 *
 * The link can be sent to users to allow them to reset their password. The optional
 * ActionCodeSettings object defines mobile app handling and additional state.
 *
 * @param email - The email address of the user whose password is to be reset
 * @param actionCodeSettings - Optional action code settings
 * @param oauth2AccessToken - OAuth2 access token for Firebase Admin API
 * @returns Promise that resolves to the generated link
 *
 * @throws {Error} Not yet implemented
 *
 * @package
 * @internal
 */
export async function generatePasswordResetLinkHandler(
  email: string,
  actionCodeSettings: ActionCodeSettings | undefined,
  oauth2AccessToken: string
): Promise<string> {
  throw new Error("Not implemented");
}
