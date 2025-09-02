import type { UserRecord } from "../types.js";
import type { GetAccountInfoUserResponse, UserInfo, UserMetadata } from "../types/firebase-admin/user-record.js";

/**
 * Retrieves a Firebase Auth user by their unique identifier (UID).
 *
 * This function provides comprehensive user data retrieval by making a direct call
 * to the Firebase Admin API's accounts:lookup endpoint. It transforms the Firebase
 * response into a standardized UserRecord format that matches the Firebase Admin SDK.
 *
 * **Retrieved User Information:**
 * - **Basic Profile**: uid, email, emailVerified, displayName, photoURL, phoneNumber
 * - **Account Status**: disabled status, creation and last sign-in timestamps
 * - **Provider Data**: All linked authentication providers with their details
 * - **Custom Claims**: Parsed from customAttributes if present
 * - **Metadata**: Creation time, last sign-in time, last refresh time
 *
 * **Firebase API Integration:**
 * - Uses Firebase Admin API's `accounts:lookup` endpoint
 * - Requires valid OAuth2 access token with admin privileges
 * - Handles Firebase response format `{ users: [GetAccountInfoUserResponse] }`
 * - Safely processes optional fields with proper null handling
 * - Transforms provider information to match Admin SDK format
 *
 * @param uid - The Firebase Auth user ID (localId) to retrieve.
 *              Must be a valid, existing Firebase user identifier.
 * @param oauth2AccessToken - Valid OAuth2 access token with Firebase Admin API privileges.
 *                           Obtained via service account authentication.
 *
 * @returns Promise that resolves to the UserRecord containing complete user information.
 *
 * @throws {Error} When user lookup fails or user doesn't exist:
 *   - "Failed to get user: {status} {statusText}, {details}" - Firebase API errors with HTTP details
 *   - "User not found: {uid}" - No user exists with the specified UID
 *   - Network errors during Firebase API communication
 *   - JSON parsing errors from malformed Firebase responses
 *
 * @example
 * ```typescript
 * // Basic user retrieval
 * const user = await getUserHandler('user123', oauth2Token);
 * console.log(`User: ${user.displayName} (${user.email})`);
 * console.log(`Created: ${user.metadata.creationTime}`);
 * console.log(`Verified: ${user.emailVerified}`);
 * ```
 *
 * @example
 * ```typescript
 * // Check user status and providers
 * const user = await getUserHandler('user456', oauth2Token);
 *
 * if (user.disabled) {
 *   console.log('Account is disabled');
 * }
 *
 * // List all authentication providers
 * user.providerData.forEach(provider => {
 *   console.log(`Provider: ${provider.providerId} - ${provider.email}`);
 * });
 *
 * // Access custom claims if available
 * const customClaims = user.customClaims;
 * if (customClaims?.role) {
 *   console.log(`User role: ${customClaims.role}`);
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Error handling with detailed information
 * try {
 *   const user = await getUserHandler(userId, oauth2Token);
 *   console.log('User retrieved successfully:', user.uid);
 * } catch (error) {
 *   if (error.message.includes('User not found')) {
 *     console.error('User does not exist:', userId);
 *   } else if (error.message.includes('Failed to get user')) {
 *     console.error('Firebase API error:', error.message);
 *   } else {
 *     console.error('Unexpected error:', error);
 *   }
 * }
 * ```
 *
 * **Important Notes:**
 * - Returns complete user profile including sensitive information (use appropriate access controls)
 * - Custom claims are automatically parsed from Firebase's customAttributes field
 * - Provider data includes all linked authentication methods (Google, Facebook, etc.)
 * - Metadata timestamps are in ISO 8601 format or empty strings if not available
 * - Phone numbers are returned in the format stored in Firebase (may not be E.164)
 * - Disabled users can still be retrieved but cannot authenticate
 * - This function requires Firebase Admin privileges - ensure proper token scoping
 *
 * @see {@link https://firebase.google.com/docs/auth/admin/manage-users Firebase User Management}
 * @see {@link https://firebase.google.com/docs/reference/rest/auth#section-get-account-info Firebase REST API}
 * @see {@link UserRecord} For complete UserRecord interface documentation
 *
 * @package
 * @since 1.0.0
 */
export async function getUserHandler(uid: string, oauth2AccessToken: string): Promise<UserRecord> {
  const response = await fetch("https://identitytoolkit.googleapis.com/v1/accounts:lookup", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${oauth2AccessToken}`,
    },
    body: JSON.stringify({
      localId: [uid],
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to get user: ${response.status} ${response.statusText}, ${await response.text()}`);
  }

  const data = (await response.json()) as { users: GetAccountInfoUserResponse[] };
  let userData: GetAccountInfoUserResponse | undefined;

  try {
    userData = data.users[0];
  } catch (error) {
    console.error("Error parsing user data:", error);
    throw new Error(`User not found: ${uid}`);
  }

  if (!userData) {
    throw new Error(`User not found: ${uid}`);
  }

  const userRecord: UserRecord = convertToUserRecord(userData!);

  return userRecord;
}

/**
 * Converts Firebase's GetAccountInfoUserResponse to a UserRecord to match
 * the Firebase Admin SDK format.
 *
 * This function safely handles optional fields and transforms the Firebase API
 * response structure into a standardized UserRecord. It includes proper null
 * handling, custom claims parsing, and provider data transformation.
 *
 * @param userData - The raw user data from Firebase Admin API.
 * @returns The converted UserRecord with all available user information.
 * @internal
 */
function convertToUserRecord(userData: GetAccountInfoUserResponse): UserRecord {
  // Safely map provider user info, handling optional fields properly
  const userInfo: UserInfo[] =
    userData.providerUserInfo?.map(
      (providerUserInfo) =>
        ({
          uid: providerUserInfo.rawId || providerUserInfo.federatedId || "",
          displayName: providerUserInfo.displayName || null,
          email: providerUserInfo.email || null,
          photoURL: providerUserInfo.photoUrl || null,
          providerId: providerUserInfo.providerId,
          phoneNumber: providerUserInfo.phoneNumber || null,
        } as UserInfo)
    ) || [];

  // Parse custom claims from customAttributes JSON string
  let customClaims: { [key: string]: any } | null = null;
  if (userData.customAttributes) {
    try {
      customClaims = JSON.parse(userData.customAttributes);
    } catch (error) {
      // Invalid JSON in customAttributes, leave as null
      console.warn("Failed to parse custom attributes as JSON:", error);
    }
  }

  const userRecord: UserRecord = {
    uid: userData.localId,
    email: userData.email || null,
    emailVerified: userData.emailVerified || false,
    displayName: userData.displayName || null,
    photoURL: userData.photoUrl || null,
    phoneNumber: userData.phoneNumber || null,
    disabled: userData.disabled || false,
    providerData: userInfo,
    customClaims: customClaims,
    metadata: {
      creationTime: userData.createdAt || "",
      lastSignInTime: userData.lastLoginAt || "",
      lastRefreshTime: userData.lastRefreshAt || null,
    } as UserMetadata,
  } as UserRecord;

  return userRecord;
}
