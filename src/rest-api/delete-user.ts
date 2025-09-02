/**
 * Deletes an existing Firebase Auth user permanently from the system.
 *
 * This function completely removes a user account and all associated data from Firebase Auth.
 * Once deleted, the user cannot be recovered and will need to create a new account if they
 * wish to access the system again. This operation is permanent and irreversible.
 *
 * **Important Implementation Details:**
 * - Permanently deletes the user account from Firebase Auth
 * - All user data including profile information, custom claims, and metadata is removed
 * - Linked provider accounts are unlinked and removed
 * - Multi-factor authentication settings are deleted
 * - The operation is idempotent - deleting a non-existent user succeeds silently
 * - Uses Firebase Admin API's `accounts:delete` endpoint
 *
 * **Security Considerations:**
 * - This operation cannot be undone - user data is permanently lost
 * - Should be used with extreme caution in production environments
 * - Consider disabling users instead of deleting for audit and recovery purposes
 * - Requires proper authorization and access control in production systems
 * - May affect user sessions and active tokens immediately
 *
 * **Use Cases:**
 * - User account closure requests (GDPR compliance)
 * - Administrative account management
 * - Cleanup of test or demo accounts
 * - System maintenance and data purging
 * - User request for account deletion
 *
 * **Behavioral Notes:**
 * - **Idempotent Operation**: Deleting a non-existent user does not throw an error
 * - **Immediate Effect**: User cannot authenticate immediately after deletion
 * - **Related Data**: Only Firebase Auth data is deleted - external data must be handled separately
 * - **Audit Trail**: Consider logging deletion events for compliance and debugging
 * - **Batch Operations**: For bulk deletions, consider using deleteUsersHandler instead
 *
 * @param uid - The Firebase Auth user ID (localId) of the user to delete.
 *              Must be a valid Firebase user identifier string.
 * @param oauth2AccessToken - Valid OAuth2 access token with Firebase Admin API privileges.
 *                           Obtained via service account authentication.
 *
 * @returns Promise that resolves when the deletion is complete.
 *          No return value - success is indicated by promise resolution.
 *          The promise resolves successfully even if the user doesn't exist.
 *
 * @throws {Error} When deletion fails due to system errors:
 *   - **Validation Errors**:
 *     - "uid must be a non-empty string" - Invalid or missing uid parameter
 *     - "oauth2AccessToken must be a non-empty string" - Invalid or missing token parameter
 *   - **Firebase API Errors**:
 *     - "Failed to delete user: {status} {statusText} - {details}" - API errors with detailed information
 *     - "INVALID_ID_TOKEN" - OAuth2 token is invalid or expired
 *     - "PERMISSION_DENIED" - Insufficient permissions to delete users
 *   - **Network Errors**: Various network-related failures during API communication
 *
 * @example
 * ```typescript
 * // Delete a user account (basic usage)
 * try {
 *   await deleteUserHandler('user123', oauth2Token);
 *   console.log('User account deleted successfully');
 * } catch (error) {
 *   console.error('Failed to delete user:', error.message);
 * }
 * ```
 *
 * @example
 * ```typescript
 * // User-initiated account deletion with confirmation
 * async function handleAccountDeletion(userId: string) {
 *   try {
 *     // 1. Verify user identity and intent
 *     const user = await getUserHandler(userId, oauth2Token);
 *     console.log(`Deleting account for: ${user.email}`);
 *
 *     // 2. Perform additional cleanup (external data, files, etc.)
 *     await cleanupUserData(userId);
 *
 *     // 3. Delete the Firebase Auth account
 *     await deleteUserHandler(userId, oauth2Token);
 *
 *     console.log('Account deletion completed');
 *   } catch (error) {
 *     console.error('Account deletion failed:', error.message);
 *     throw error;
 *   }
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Administrative cleanup with error handling
 * async function adminDeleteInactiveUsers(userIds: string[]) {
 *   const results = [];
 *
 *   for (const userId of userIds) {
 *     try {
 *       await deleteUserHandler(userId, oauth2Token);
 *       results.push({ userId, status: 'deleted', error: null });
 *     } catch (error) {
 *       results.push({ userId, status: 'failed', error: error.message });
 *     }
 *   }
 *
 *   return results;
 * }
 * ```
 *
 * @example
 * ```typescript
 * // GDPR compliance workflow
 * async function processGDPRDeletionRequest(userEmail: string) {
 *   try {
 *     // 1. Find the user by email
 *     const user = await getUserByEmailHandler(userEmail, oauth2Token);
 *
 *     // 2. Export user data for compliance (if required)
 *     const userData = await exportUserData(user.uid);
 *     await saveDataExport(userData, `${userEmail}-export.json`);
 *
 *     // 3. Delete associated external data
 *     await deleteUserFromDatabase(user.uid);
 *     await deleteUserFiles(user.uid);
 *
 *     // 4. Delete the Firebase Auth account
 *     await deleteUserHandler(user.uid, oauth2Token);
 *
 *     // 5. Log the deletion for audit purposes
 *     await logGDPRDeletion({
 *       userEmail,
 *       userId: user.uid,
 *       deletedAt: new Date(),
 *       reason: 'GDPR_REQUEST'
 *     });
 *
 *     console.log(`GDPR deletion completed for ${userEmail}`);
 *   } catch (error) {
 *     console.error(`GDPR deletion failed for ${userEmail}:`, error);
 *     throw error;
 *   }
 * }
 * ```
 *
 * **Technical Implementation:**
 * - Makes POST request to `https://identitytoolkit.googleapis.com/v1/accounts:delete`
 * - Sends `localId` parameter to identify the target user
 * - Handles Firebase API error responses with detailed error information
 * - Validates input parameters before making API calls
 * - Operates idempotently - no error for non-existent users
 *
 * **Testing Considerations:**
 * - Create test users specifically for deletion tests
 * - Verify user is actually deleted by attempting to retrieve them
 * - Test idempotent behavior by deleting non-existent users
 * - Unit tests should mock the fetch call and verify request format
 * - Integration tests should verify actual deletion from Firebase
 *
 * **Production Considerations:**
 * - **Logging**: Log all deletion operations for audit trails
 * - **Confirmation**: Implement confirmation flows for critical deletions
 * - **Backup**: Consider backing up user data before deletion
 * - **Related Data**: Ensure external data is properly cleaned up
 * - **Rate Limits**: Be aware of Firebase API rate limits for bulk operations
 * - **Alternative**: Consider using `disabled: true` instead of deletion for recoverable scenarios
 *
 * @see {@link getUserHandler} For retrieving user data before deletion
 * @see {@link updateUserHandler} For disabling users instead of deletion
 * @see {@link deleteUsersHandler} For bulk deletion operations
 * @see {@link https://firebase.google.com/docs/auth/admin/manage-users#delete_a_user Firebase User Deletion}
 * @see {@link https://firebase.google.com/docs/reference/rest/auth#section-delete-account Firebase REST API}
 *
 * @package
 * @since 1.0.0
 */
export async function deleteUserHandler(uid: string, oauth2AccessToken: string): Promise<void> {
  // Validate input parameters
  if (typeof uid !== "string" || uid.length === 0) {
    throw new Error("uid must be a non-empty string");
  }

  if (typeof oauth2AccessToken !== "string" || oauth2AccessToken.length === 0) {
    throw new Error("oauth2AccessToken must be a non-empty string");
  }

  // Make the API call to delete the user
  const response = await fetch("https://identitytoolkit.googleapis.com/v1/accounts:delete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${oauth2AccessToken}`,
    },
    body: JSON.stringify({
      localId: uid,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage: string;

    try {
      const errorData = JSON.parse(errorText);
      const formattedErrorText = JSON.stringify(errorData, null, 2);
      errorMessage = `Failed to delete user: ${response.status} ${response.statusText}\n${formattedErrorText}`;
    } catch {
      errorMessage = `Failed to delete user: ${response.status} ${response.statusText} - ${errorText}`;
    }

    throw new Error(errorMessage);
  }
}
