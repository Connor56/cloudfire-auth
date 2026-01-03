import type { AuthProviderConfig } from "../types.js";

/**
 * Creates a new Auth provider configuration.
 *
 * Creates a new SAML or OIDC provider configuration with the specified settings.
 *
 * @param config - The provider configuration to create
 * @param oauth2AccessToken - OAuth2 access token for Firebase Admin API
 * @returns Promise that resolves to the created provider configuration
 *
 * @throws {Error} Not yet implemented
 *
 * @package
 * @internal
 */
export async function createProviderConfigHandler(
  config: AuthProviderConfig,
  oauth2AccessToken: string
): Promise<AuthProviderConfig> {
  throw new Error("Not implemented");
}
