import type { UpdateRequest, UserRecord } from "../types.js";

/**
 * Updates an existing Firebase Auth user with the specified properties.
 *
 * This function provides comprehensive user management capabilities by validating
 * the update request and making a direct call to the Firebase Admin API's
 * accounts:update endpoint. All properties are validated before the API call
 * to ensure data integrity and prevent invalid requests.
 *
 * **Supported Update Operations:**
 * - **Profile Information**: displayName, photoURL
 * - **Authentication**: email, emailVerified, password, phoneNumber
 * - **Access Control**: disabled status
 * - **Multi-Factor Authentication**: MFA settings and enrolled factors
 * - **Provider Management**: link/unlink identity providers
 *
 * **Validation Rules:**
 * - Only allowed properties are accepted (rejects unknown fields)
 * - Type validation for all properties (boolean, string, object, array)
 * - Email format validation using regex pattern
 * - Password minimum length requirement (6 characters)
 * - URL validation for photoURL using URL constructor
 * - Null values allowed for clearable fields (displayName, phoneNumber, photoURL)
 *
 * **Firebase API Integration:**
 * - Uses Firebase Admin API's `accounts:update` endpoint
 * - Requires valid OAuth2 access token with admin privileges
 * - Transforms provider operations to Firebase API format automatically
 *   - `providerToLink` becomes `linkProviderUserInfo`
 *   - `providersToUnlink` becomes `deleteProvider`
 * - Handles Firebase response format `{ users: [UserRecord] }` and extracts single user
 * - Returns the updated user data from Firebase's response
 *
 * @param uid - The Firebase Auth user ID (localId) to update.
 *              Must be a valid, existing Firebase user identifier.
 * @param properties - The properties to update for the user.
 *                    Must contain valid UpdateRequest fields only.
 * @param oauth2AccessToken - Valid OAuth2 access token with Firebase Admin API privileges.
 *                           Obtained via service account authentication.
 *
 * @returns Promise that resolves to the updated UserRecord from Firebase.
 *
 * @throws {Error} When validation or API operations fail:
 *   - "Invalid properties provided: {props}" - Unknown properties in request
 *   - "{field} must be a {type}" - Type validation failures
 *   - "Invalid email format" - Email doesn't match regex pattern
 *   - "password must be at least 6 characters long" - Password too short
 *   - "photoURL must be a valid URL" - URL validation failed
 *   - "Failed to update user: {status} {statusText} - {details}" - Firebase API errors with detailed messages
 *   - "Invalid response from Firebase API - no user data returned" - Unexpected response format
 *   - Network errors during Firebase API communication
 *
 * @example
 * ```typescript
 * // Update basic profile information
 * const updatedUser = await updateUserHandler(
 *   'user123',
 *   {
 *     displayName: 'John Doe',
 *     photoURL: 'https://example.com/photo.jpg'
 *   },
 *   oauth2Token
 * );
 *
 * // Update authentication credentials
 * const userWithNewEmail = await updateUserHandler(
 *   'user456',
 *   {
 *     email: 'newemail@example.com',
 *     emailVerified: false,
 *     password: 'newSecurePassword123'
 *   },
 *   oauth2Token
 * );
 *
 * // Clear optional fields with null
 * const userWithClearedFields = await updateUserHandler(
 *   'user789',
 *   {
 *     displayName: null,
 *     phoneNumber: null,
 *     photoURL: null
 *   },
 *   oauth2Token
 * );
 * ```
 *
 * @example
 * ```typescript
 * // Provider management
 * const userWithProvider = await updateUserHandler(
 *   'user123',
 *   {
 *     providerToLink: {
 *       providerId: 'google.com',
 *       uid: 'google-uid-12345'
 *     }
 *   },
 *   oauth2Token
 * );
 *
 * // Remove providers
 * const userWithoutProviders = await updateUserHandler(
 *   'user456',
 *   {
 *     providersToUnlink: ['facebook.com', 'twitter.com']
 *   },
 *   oauth2Token
 * );
 * ```
 *
 * @example
 * ```typescript
 * // Error handling
 * try {
 *   const updatedUser = await updateUserHandler(userId, updates, oauth2Token);
 *   console.log('User updated successfully:', updatedUser.uid);
 * } catch (error) {
 *   if (error.message.includes('Invalid properties provided')) {
 *     console.error('Unknown properties in request:', error.message);
 *   } else if (error.message.includes('Invalid email format')) {
 *     console.error('Please provide a valid email address');
 *   } else if (error.message.includes('Failed to update user')) {
 *     console.error('Firebase API error with details:', error.message);
 *   } else if (error.message.includes('Invalid response from Firebase API')) {
 *     console.error('Unexpected Firebase response format:', error.message);
 *   } else {
 *     console.error('Unexpected error:', error);
 *   }
 * }
 * ```
 *
 * **Important Notes:**
 * - Updates are atomic - either all succeed or none are applied
 * - Password updates may invalidate existing user sessions
 * - Email updates should be followed by verification flows
 * - Phone number validation is currently disabled (see TODO in validation)
 * - Provider operations are automatically transformed to Firebase API format
 * - Multi-factor and provider operations affect available authentication methods
 * - Disabled users cannot sign in until re-enabled
 * - Response format is standardized to return single UserRecord (extracted from Firebase's array format)
 *
 * @see {@link checkUpdateUserRequest} For detailed validation rules
 * @see {@link https://firebase.google.com/docs/auth/admin/manage-users Firebase User Management}
 * @see {@link https://firebase.google.com/docs/reference/rest/auth#section-update-account Firebase REST API}
 *
 * @since 1.0.0
 */
export async function updateUserHandler(
  uid: string,
  properties: UpdateRequest,
  oauth2AccessToken: string
): Promise<UserRecord> {
  const validProperties = checkUpdateUserRequest(properties);

  // Transform provider operations to Firebase API format
  const requestBody: any = {
    ...validProperties,
    localId: uid,
  };

  // Handle provider linking transformation
  if (validProperties.providerToLink) {
    requestBody.linkProviderUserInfo = validProperties.providerToLink;
    delete requestBody.providerToLink;
  }

  // Handle provider unlinking transformation
  if (validProperties.providersToUnlink) {
    requestBody.deleteProvider = validProperties.providersToUnlink;
    delete requestBody.providersToUnlink;
  }

  const response = await fetch("https://identitytoolkit.googleapis.com/v1/accounts:update", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${oauth2AccessToken}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage: string;

    try {
      console.log("errorText", errorText);
      const errorData = JSON.parse(errorText);

      const formattedErrorText = JSON.stringify(errorData, null, 2);

      errorMessage = `Failed to update user: ${response.status} ${response.statusText}\n${formattedErrorText}`;
    } catch {
      errorMessage = `Failed to update user: ${response.status} ${response.statusText} - ${errorText}`;
    }

    throw new Error(errorMessage);
  }

  const data = (await response.json()) as { users?: UserRecord[] };

  // Firebase returns { users: [UserRecord] }, extract the single user
  if (data.users && Array.isArray(data.users) && data.users.length > 0) {
    return data.users[0]!;
  }

  // Fallback for unexpected response format
  throw new Error("Invalid response from Firebase API - no user data returned");
}

/**
 * Checks the update user request had valid properties. Meaning it checks
 * the keys on the properties object are allowed and the values are of
 * the correct type. If any of the properties are invalid, an error is thrown.
 *
 * @throws {Error} If any of the properties are invalid.
 *
 * @param {UpdateRequest} properties The properties provided to update the user.
 * @return {UpdateRequest} The properties object with the valid properties.
 */
function checkUpdateUserRequest(properties: UpdateRequest): UpdateRequest {
  const allowedProperties = [
    "disabled",
    "displayName",
    "email",
    "emailVerified",
    "password",
    "phoneNumber",
    "photoURL",
    "multiFactor",
    "providerToLink",
    "providersToUnlink",
  ];

  // Check that only allowed properties are present
  const providedProperties = Object.keys(properties);
  const invalidProperties = providedProperties.filter((prop) => !allowedProperties.includes(prop));

  if (invalidProperties.length > 0) {
    throw new Error(`Invalid properties provided: ${invalidProperties.join(", ")}`);
  }

  // Validate each field if present
  if (properties.disabled !== undefined && typeof properties.disabled !== "boolean") {
    throw new Error("disabled must be a boolean");
  }

  if (
    properties.displayName !== undefined &&
    properties.displayName !== null &&
    typeof properties.displayName !== "string"
  ) {
    throw new Error("displayName must be a string or null");
  }

  if (properties.email !== undefined) {
    if (typeof properties.email !== "string") {
      throw new Error("email must be a string");
    }
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(properties.email)) {
      throw new Error("Invalid email format");
    }
  }

  if (properties.emailVerified !== undefined && typeof properties.emailVerified !== "boolean") {
    throw new Error("emailVerified must be a boolean");
  }

  if (properties.password !== undefined) {
    if (typeof properties.password !== "string") {
      throw new Error("password must be a string");
    }
    if (properties.password.length < 6) {
      throw new Error("password must be at least 6 characters long");
    }
  }

  if (properties.phoneNumber !== undefined && properties.phoneNumber !== null) {
    if (typeof properties.phoneNumber !== "string") {
      throw new Error("phoneNumber must be a string or null");
    }
    // TODO: Decide if phone number validation is needed
    // // Basic phone number validation (E.164 format)
    // const phoneRegex = /^\+[1-9]\d{1,14}$/;
    // if (!phoneRegex.test(properties.phoneNumber)) {
    //   throw new Error('phoneNumber must be in E.164 format (e.g., +16505550123)');
    // }
  }

  if (properties.photoURL !== undefined && properties.photoURL !== null) {
    if (typeof properties.photoURL !== "string") {
      throw new Error("photoURL must be a string or null");
    }
    try {
      new URL(properties.photoURL);
    } catch {
      throw new Error("photoURL must be a valid URL");
    }
  }

  if (properties.multiFactor !== undefined) {
    if (properties.multiFactor !== null && typeof properties.multiFactor !== "object") {
      throw new Error("multiFactor must be an object or null");
    }
    if (
      properties.multiFactor?.enrolledFactors !== undefined &&
      properties.multiFactor.enrolledFactors !== null &&
      !Array.isArray(properties.multiFactor.enrolledFactors)
    ) {
      throw new Error("multiFactor.enrolledFactors must be an array or null");
    }
  }

  if (
    properties.providerToLink !== undefined &&
    (typeof properties.providerToLink !== "object" || properties.providerToLink === null)
  ) {
    throw new Error("providerToLink must be a UserProvider object");
  }

  if (properties.providersToUnlink !== undefined) {
    if (!Array.isArray(properties.providersToUnlink)) {
      throw new Error("providersToUnlink must be an array");
    }
    if (!properties.providersToUnlink.every((provider) => typeof provider === "string")) {
      throw new Error("all providers in providersToUnlink must be strings");
    }
  }

  return properties;
}
