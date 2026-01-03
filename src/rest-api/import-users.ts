import type { UserImportRecord, UserImportOptions, UserImportResult } from "../types.js";

/**
 * Imports a list of users into Firebase Auth.
 *
 * A maximum of 1000 users can be imported at once. When importing users with passwords,
 * UserImportOptions are required to specify the hash algorithm.
 *
 * @param users - The list of user records to import
 * @param options - Optional import options, required when importing password hashes
 * @param oauth2AccessToken - OAuth2 access token for Firebase Admin API
 * @returns Promise that resolves to the import result
 *
 * @throws {Error} Not yet implemented
 *
 * @package
 * @internal
 */
export async function importUsersHandler(
  users: UserImportRecord[],
  options: UserImportOptions | undefined,
  oauth2AccessToken: string
): Promise<UserImportResult> {
  throw new Error("Not implemented");
}
