import type { ActionCodeSettings } from "../types.js";

/**
 * Generates a sign-in with email link for the specified email address.
 *
 * This link allows users to sign in via email link without a password. The
 * ActionCodeSettings object is required to specify where the link should redirect.
 *
 * @param email - The email account to generate the sign-in link for
 * @param actionCodeSettings - Action code settings (required)
 * @param oauth2AccessToken - OAuth2 access token for Firebase Admin API
 * @returns Promise that resolves to the generated link
 *
 * @throws {Error} Not yet implemented
 *
 * @package
 * @internal
 */
export async function generateSignInWithEmailLinkHandler(
  email: string,
  actionCodeSettings: ActionCodeSettings,
  oauth2AccessToken: string
): Promise<string> {
  throw new Error("Not implemented");
}
