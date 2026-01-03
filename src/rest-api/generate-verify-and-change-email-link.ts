import type { ActionCodeSettings } from "../types.js";

/**
 * Generates an out-of-band email action link to verify and change a user's email.
 *
 * This link allows users to verify ownership of a new email address before updating
 * their account email. The optional ActionCodeSettings object defines mobile app
 * handling and additional state.
 *
 * @param email - The current email account
 * @param newEmail - The email address the account is being updated to
 * @param actionCodeSettings - Optional action code settings
 * @param oauth2AccessToken - OAuth2 access token for Firebase Admin API
 * @returns Promise that resolves to the generated link
 *
 * @throws {Error} Not yet implemented
 *
 * @package
 * @internal
 */
export async function generateVerifyAndChangeEmailLinkHandler(
  email: string,
  newEmail: string,
  actionCodeSettings: ActionCodeSettings | undefined,
  oauth2AccessToken: string
): Promise<string> {
  throw new Error("Not implemented");
}
