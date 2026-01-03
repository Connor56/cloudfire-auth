import type { AuthProviderConfigFilter, ListProviderConfigResults } from "../types.js";

/**
 * Lists provider configurations matching the specified filter.
 *
 * Returns a list of SAML or OIDC provider configurations. At most 100 provider
 * configs can be listed at a time.
 *
 * @param options - The provider config filter to apply
 * @param oauth2AccessToken - OAuth2 access token for Firebase Admin API
 * @returns Promise that resolves to the list of provider configs
 *
 * @throws {Error} Not yet implemented
 *
 * @package
 * @internal
 */
export async function listProviderConfigsHandler(
  options: AuthProviderConfigFilter,
  oauth2AccessToken: string
): Promise<ListProviderConfigResults> {
  throw new Error("Not implemented");
}
