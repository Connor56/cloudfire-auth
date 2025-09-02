/**
 * Revokes all refresh tokens for an existing Firebase Auth user.
 *
 * This function updates the user's `tokensValidAfterTime` to the current UTC timestamp,
 * effectively invalidating all existing refresh tokens and sessions for the specified user.
 * After calling this function, the user will need to re-authenticate to obtain new tokens.
 *
 * **Important Implementation Details:**
 * - Updates the user's `tokensValidAfterTime` to the current UTC timestamp (in seconds)
 * - All existing refresh tokens become invalid immediately
 * - Existing ID tokens remain valid until their natural expiration (1 hour) unless verified with `checkRevoked=true`
 * - Requires accurate server time synchronization for proper functionality
 * - Uses Firebase Admin API's `accounts:update` endpoint with `validSince` parameter
 *
 * **Security Considerations:**
 * - Forces user re-authentication on all devices and sessions
 * - Useful for compromised accounts or mandatory sign-out scenarios
 * - Should be combined with ID token verification using `checkRevoked=true` for immediate effect
 * - Does not affect the user's account data or profile information
 *
 * **Use Cases:**
 * - Security incident response (compromised accounts)
 * - Forced logout from all devices
 * - Administrative account suspension workflows
 * - Password change security measures
 * - Device management and session control
 *
 * @param uid - The Firebase Auth user ID (localId) whose refresh tokens should be revoked.
 *              Must be a valid, existing Firebase user identifier.
 * @param oauth2AccessToken - Valid OAuth2 access token with Firebase Admin API privileges.
 *                           Obtained via service account authentication.
 *
 * @returns Promise that resolves when the revocation is complete.
 *          No return value - success is indicated by promise resolution.
 *
 * @throws {Error} When revocation fails:
 *   - **Validation Errors**:
 *     - "uid must be a non-empty string" - Invalid or missing uid parameter
 *   - **Firebase API Errors**:
 *     - "Failed to revoke refresh tokens: {status} {statusText} - {details}" - API errors with detailed information
 *     - "USER_NOT_FOUND" - Specified user does not exist
 *     - "INVALID_ID_TOKEN" - OAuth2 token is invalid or expired
 *   - **Network Errors**: Various network-related failures during API communication
 *
 * @example
 * ```typescript
 * // Revoke all refresh tokens for a user (security incident)
 * try {
 *   await revokeRefreshTokensHandler('user123', oauth2Token);
 *   console.log('All refresh tokens revoked successfully');
 *
 *   // Verify that existing ID tokens are now invalid
 *   await verifyIdTokenHandler(existingIdToken, projectId, oauth2Token, kvNamespace, true);
 * } catch (error) {
 *   if (error.message.includes('id-token-revoked')) {
 *     console.log('Tokens successfully revoked - existing ID token is invalid');
 *   } else {
 *     console.error('Failed to revoke tokens:', error);
 *   }
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Force logout from all devices after password change
 * try {
 *   // First update the password
 *   await updateUserHandler('user456', { password: 'newSecurePassword' }, oauth2Token);
 *
 *   // Then revoke all existing sessions for security
 *   await revokeRefreshTokensHandler('user456', oauth2Token);
 *
 *   console.log('Password updated and all sessions revoked');
 * } catch (error) {
 *   console.error('Security update failed:', error);
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Administrative account suspension workflow
 * try {
 *   // Disable the account
 *   await updateUserHandler('suspendedUser', { disabled: true }, oauth2Token);
 *
 *   // Revoke all active sessions
 *   await revokeRefreshTokensHandler('suspendedUser', oauth2Token);
 *
 *   console.log('Account suspended and all sessions terminated');
 * } catch (error) {
 *   console.error('Account suspension failed:', error);
 * }
 * ```
 *
 * **Technical Implementation:**
 * - Makes POST request to `https://identitytoolkit.googleapis.com/v1/accounts:update`
 * - Sets `validSince` to current timestamp: `Math.floor(Date.now() / 1000)`
 * - Uses `localId` parameter to identify the target user
 * - Handles Firebase API error responses with detailed error information
 * - Validates input parameters before making API calls
 *
 * **Testing Considerations:**
 * - Can be verified by attempting to verify existing ID tokens with `checkRevoked=true`
 * - Integration tests should create tokens, revoke them, then verify revocation
 * - Unit tests should mock the fetch call and verify request format
 * - Error scenarios should test various Firebase API error responses
 *
 * @see {@link verifyIdTokenHandler} For verifying ID tokens with revocation checking
 * @see {@link updateUserHandler} For other user management operations
 * @see {@link https://firebase.google.com/docs/auth/admin/manage-sessions#revoke_refresh_tokens Firebase Session Management}
 * @see {@link https://firebase.google.com/docs/reference/rest/auth#section-update-account Firebase REST API}
 *
 * @package
 * @since 1.0.0
 */
export async function revokeRefreshTokensHandler(uid: string, oauth2AccessToken: string): Promise<void> {
  // Validate input parameters
  if (typeof uid !== "string" || uid.length === 0) {
    throw new Error("uid must be a non-empty string");
  }

  if (typeof oauth2AccessToken !== "string" || oauth2AccessToken.length === 0) {
    throw new Error("oauth2AccessToken must be a non-empty string");
  }

  // Set validSince to current timestamp (in seconds)
  const validSince = Math.floor(Date.now() / 1000).toString();

  // Make the API call to revoke refresh tokens
  const response = await fetch("https://identitytoolkit.googleapis.com/v1/accounts:update", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${oauth2AccessToken}`,
    },
    body: JSON.stringify({
      localId: uid,
      validSince: validSince,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage: string;

    try {
      const errorData = JSON.parse(errorText);
      const formattedErrorText = JSON.stringify(errorData, null, 2);
      errorMessage = `Failed to revoke refresh tokens: ${response.status} ${response.statusText}\n${formattedErrorText}`;
    } catch {
      errorMessage = `Failed to revoke refresh tokens: ${response.status} ${response.statusText} - ${errorText}`;
    }

    throw new Error(errorMessage);
  }
}
