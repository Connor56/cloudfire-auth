import type { UpdateAuthProviderRequest, AuthProviderConfig } from "../types.js";

/**
 * Updates an existing Auth provider configuration.
 *
 * Updates the provider configuration for the specified provider ID with the
 * new settings. Throws an error if the configuration does not exist.
 *
 * @param providerId - The provider ID corresponding to the provider config to update
 * @param updatedConfig - The updated configuration
 * @param oauth2AccessToken - OAuth2 access token for Firebase Admin API
 * @returns Promise that resolves to the updated provider configuration
 *
 * @throws {Error} Not yet implemented
 *
 * @package
 * @internal
 */
export async function updateProviderConfigHandler(
  providerId: string,
  updatedConfig: UpdateAuthProviderRequest,
  oauth2AccessToken: string
): Promise<AuthProviderConfig> {
  throw new Error("Not implemented");
}
