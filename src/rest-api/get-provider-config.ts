import type { AuthProviderConfig } from "../types.js";

/**
 * Retrieves an Auth provider configuration by provider ID.
 *
 * Returns the provider configuration for the specified ID. Throws an error if
 * the configuration does not exist.
 *
 * @param providerId - The provider ID corresponding to the provider config
 * @param oauth2AccessToken - OAuth2 access token for Firebase Admin API
 * @returns Promise that resolves to the provider configuration
 *
 * @throws {Error} Not yet implemented
 *
 * @package
 * @internal
 */
export async function getProviderConfigHandler(
  providerId: string,
  oauth2AccessToken: string
): Promise<AuthProviderConfig> {
  throw new Error("Not implemented");
}
