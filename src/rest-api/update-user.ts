import type { UpdateRequest, UserRecord, SetAccountInfoResponse } from "../types.js";
import { getUserHandler } from "./get-user.js";

const deletableAttributes = {
  displayName: "DISPLAY_NAME",
  photoURL: "PHOTO_URL",
  // TODO: Decide if these should be deletable too, they're not in firebase admin SDK
  // You can see the attributes they allow you to delete here:
  // https://github.com/firebase/firebase-admin-node/blob/master/src/auth/auth-api-request.ts#L1420
  // email: "EMAIL",
  // phoneNumber: "PHONE_NUMBER",
  // provider: "PROVIDER",
  // password: "PASSWORD",
  // rawUserInfo: "RAW_USER_INFO",
};

/**
 * Updates an existing Firebase Auth user with the specified properties and returns the complete updated user record.
 *
 * This function provides comprehensive user management capabilities through a two-step process:
 * 1. **Validation & Update**: Validates the update request and calls Firebase Admin API's accounts:update endpoint
 * 2. **Data Retrieval**: Fetches the complete updated user record using getUserHandler for consistency
 *
 * This approach ensures you receive a complete, properly formatted UserRecord with all user data
 * including custom claims, metadata, provider information, and any computed fields.
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
 * - **Step 1**: Uses Firebase Admin API's `accounts:update` endpoint to apply changes
 *   - Transforms fields to Firebase API format automatically
 *   - `providerToLink` becomes `linkProviderUserInfo`
 *   - `providersToUnlink` becomes `deleteProvider`
 *   - `photoURL` becomes `photoUrl` (lowercase 'u')
 *   - Validates update response for consistency
 * - **Step 2**: Uses `getUserHandler` to retrieve complete updated user data
 *   - Ensures consistent UserRecord format across the application
 *   - Includes all user metadata, custom claims, and provider information
 *   - Handles complex data transformations automatically
 *
 * @param uid - The Firebase Auth user ID (localId) to update.
 *              Must be a valid, existing Firebase user identifier.
 * @param properties - The properties to update for the user.
 *                    Must contain valid UpdateRequest fields only.
 * @param oauth2AccessToken - Valid OAuth2 access token with Firebase Admin API privileges.
 *                           Obtained via service account authentication.
 *
 * @returns Promise that resolves to the complete updated UserRecord with all user data.
 *          The returned UserRecord includes updated fields plus all existing user information
 *          such as metadata, custom claims, provider data, and computed fields.
 *
 * @throws {Error} When validation, update, or retrieval operations fail:
 *   - **Validation Errors**:
 *     - "Invalid properties provided: {props}" - Unknown properties in request
 *     - "{field} must be a {type}" - Type validation failures
 *     - "Invalid email format" - Email doesn't match regex pattern
 *     - "password must be at least 6 characters long" - Password too short
 *     - "photoURL must be a valid URL" - URL validation failed
 *   - **Update API Errors**:
 *     - "Failed to update user: {status} {statusText}\n{details}" - Firebase API errors with detailed error information
 *     - "Invalid response from Firebase API - user ID mismatch" - Unexpected response format
 *   - **Retrieval Errors**:
 *     - "User updated successfully, but failed to retrieve updated data: {reason}" - Update succeeded but data retrieval failed
 *   - **Network Errors**: Various network-related failures during API communication
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
 * console.log('Profile updated:', updatedUser.displayName); // "John Doe"
 * console.log('Photo URL:', updatedUser.photoURL); // "https://example.com/photo.jpg"
 * console.log('User metadata:', updatedUser.metadata); // Includes creation time, last sign-in, etc.
 * ```
 *
 * @example
 * ```typescript
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
 * console.log('Email updated:', userWithNewEmail.email); // "newemail@example.com"
 * console.log('Email verified:', userWithNewEmail.emailVerified); // false
 * console.log('Provider data:', userWithNewEmail.providerData); // All linked providers
 * ```
 *
 * @example
 * ```typescript
 * // Clear optional fields with null and manage providers
 * const userWithProviderChanges = await updateUserHandler(
 *   'user789',
 *   {
 *     displayName: null, // Clear display name
 *     phoneNumber: null, // Clear phone number
 *     providersToUnlink: ['facebook.com'], // Remove Facebook provider
 *     providerToLink: { // Link new Google provider
 *       providerId: 'google.com',
 *       uid: 'google-uid-12345'
 *     }
 *   },
 *   oauth2Token
 * );
 *
 * console.log('Display name cleared:', userWithProviderChanges.displayName); // null
 * console.log('Updated providers:', userWithProviderChanges.providerData); // Reflects provider changes
 * ```
 *
 * @example
 * ```typescript
 * // Comprehensive error handling
 * try {
 *   const updatedUser = await updateUserHandler(userId, updates, oauth2Token);
 *   console.log('User updated successfully:', updatedUser.uid);
 *
 *   // The returned user includes all data - you can access any field
 *   console.log('Custom claims:', updatedUser.customClaims);
 *   console.log('Last sign-in:', updatedUser.metadata.lastSignInTime);
 *   console.log('All providers:', updatedUser.providerData);
 *
 * } catch (error) {
 *   if (error.message.includes('Invalid properties provided')) {
 *     console.error('Request validation failed:', error.message);
 *   } else if (error.message.includes('Failed to update user')) {
 *     console.error('Firebase update API error:', error.message);
 *   } else if (error.message.includes('User updated successfully, but failed to retrieve')) {
 *     console.error('Update succeeded but data retrieval failed:', error.message);
 *     // User was updated, but we couldn't get the fresh data
 *   } else {
 *     console.error('Unexpected error:', error);
 *   }
 * }
 * ```
 *
 * **Important Implementation Notes:**
 * - **Two-Step Process**: Function performs update then retrieval for complete data consistency
 * - **Atomic Updates**: Firebase update operations are atomic - either all succeed or none are applied
 * - **Complete Data**: Always returns full UserRecord with metadata, claims, providers, etc.
 * - **Consistency**: Uses same data formatting as getUserHandler for uniform API responses
 * - **Error Recovery**: Clear error messages distinguish between update and retrieval failures
 * - **Field Transformations**: Automatically handles Firebase API format differences (providers, photoURL)
 * - **Session Impact**: Password updates may invalidate existing user sessions
 * - **Email Verification**: Email updates should be followed by verification flows
 * - **Performance**: Makes two API calls but ensures data completeness and consistency
 *
 * **Security Considerations:**
 * - Requires Firebase Admin API privileges via OAuth2 token
 * - Validates all input properties before making API calls
 * - Disabled users cannot sign in until re-enabled
 * - Provider operations affect available authentication methods
 * - Phone number validation is currently minimal (see TODO in validation)
 *
 * TODO: It appears there are still parts that require implementation:
 * https://github.com/firebase/firebase-admin-node/blob/master/src/auth/auth-api-request.ts#L1371
 *
 * @see {@link checkUpdateUserRequest} For detailed validation rules and allowed properties
 * @see {@link getUserHandler} For the data retrieval implementation used in step 2
 * @see {@link https://firebase.google.com/docs/auth/admin/manage-users Firebase User Management}
 * @see {@link https://firebase.google.com/docs/reference/rest/auth#section-update-account Firebase REST API}
 *
 * @package
 * @since 1.0.0
 */
export async function updateUserHandler(
  uid: string,
  properties: UpdateRequest,
  oauth2AccessToken: string
): Promise<UserRecord> {
  const validProperties = checkUpdateUserRequest(properties);

  if (typeof uid !== "string" || uid.length === 0) {
    throw new Error("uid must be a non-empty string, got: " + uid);
  }

  // Transform provider operations to Firebase API format
  const requestBody: any = {
    ...validProperties,
    localId: uid,
  };

  // Handle deletable attributes
  requestBody.deleteAttribute = [];
  for (const key in deletableAttributes) {
    if (validProperties[key as keyof UpdateRequest] === null) {
      requestBody.deleteAttribute.push(deletableAttributes[key as keyof typeof deletableAttributes]);

      delete requestBody[key];
    }
  }

  // Remove deleteAttribute if it's empty
  if (requestBody.deleteAttribute.length === 0) {
    delete requestBody.deleteAttribute;
  }

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

  // Transform photoURL to photoUrl for Firebase API
  if (requestBody.photoURL !== undefined) {
    requestBody.photoUrl = requestBody.photoURL;
    delete requestBody.photoURL;
  }

  // Transform disabled to disableUser
  if (validProperties.disabled !== undefined) {
    requestBody.disableUser = validProperties.disabled;
    delete requestBody.disabled;
  }

  // Transform phoneNumber into a provider deletion if it's set to null
  if (requestBody.phoneNumber === null) {
    requestBody.deleteProvider ? requestBody.deleteProvider.push("phone") : (requestBody.deleteProvider = ["phone"]);
    delete requestBody.phoneNumber;
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
      const errorData = JSON.parse(errorText);
      const formattedErrorText = JSON.stringify(errorData, null, 2);
      errorMessage = `Failed to update user: ${response.status} ${response.statusText}\n${formattedErrorText}`;
    } catch {
      errorMessage = `Failed to update user: ${response.status} ${response.statusText} - ${errorText}`;
    }

    throw new Error(errorMessage);
  }

  const data = (await response.json()) as SetAccountInfoResponse;

  if (data.localId !== uid) {
    throw new Error("Invalid response from Firebase API - user ID mismatch");
  }

  // Retrieve the complete updated user record
  try {
    const updatedUserRecord = await getUserHandler(uid, oauth2AccessToken);

    return updatedUserRecord;
  } catch (error) {
    throw new Error(`User updated successfully, but failed to retrieve updated data: ${(error as Error).message}`);
  }
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

  if (Object.keys(properties).length === 0) {
    throw new Error("Request body is empty. Please provide at least one property to update.");
  }

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
