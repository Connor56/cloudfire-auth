/**
 * Sets custom user claims for a Firebase Auth user.
 *
 * Custom claims are key-value pairs that provide additional information about a user
 * that can be used for access control and authorization. These claims are included in
 * the user's ID token and can be accessed by client applications.
 *
 * **Validation & Security:**
 * - Validates claims against Firebase Auth and OIDC reserved names
 * - Enforces 1000-byte size limit for serialized claims
 * - Rejects invalid input types (arrays, primitives, etc.)
 * - Prevents privilege escalation by blocking system claims
 *
 * **Firebase API Integration:**
 * - Uses Firebase Admin API's `accounts:update` endpoint
 * - Requires valid OAuth2 access token with admin privileges
 * - Handles network errors and API response validation
 * - Supports both setting new claims and clearing existing claims (null)
 *
 * **Common Use Cases:**
 * - Role-based access control: `{ role: 'admin', department: 'IT' }`
 * - Feature flags: `{ features: ['beta', 'premium'] }`
 * - Organization membership: `{ orgId: 'acme-corp', permissions: ['read', 'write'] }`
 * - Subscription levels: `{ plan: 'enterprise', expires: '2024-12-31' }`
 *
 * @param uid - The Firebase Auth user ID (localId) to set claims for.
 *              Must be a valid Firebase user identifier.
 * @param customUserClaims - The custom claims object to set for the user.
 *                          Pass `null` to clear all existing custom claims.
 *                          Must comply with Firebase Auth restrictions.
 * @param oauth2AccessToken - Valid OAuth2 access token with Firebase Admin API privileges.
 *                           Obtained via service account authentication.
 *
 * @returns Promise that resolves when claims are successfully set.
 *
 * @throws {Error} When validation or API operations fail:
 *   - "Invalid custom user claims" - Claims validation failed (see checkClaimsAreValid)
 *   - "Failed to set custom user claims: {status} {statusText}, {body}" - Firebase API error
 *   - Network errors during Firebase API communication
 *
 * @example
 * ```typescript
 * // Set role-based claims
 * await setCustomUserClaimsHandler(
 *   'user123',
 *   { role: 'admin', department: 'engineering' },
 *   oauth2Token
 * );
 *
 * // Set organization claims
 * await setCustomUserClaimsHandler(
 *   'user456',
 *   {
 *     organization: 'acme-corp',
 *     permissions: ['users:read', 'billing:write'],
 *     subscription: { plan: 'enterprise', expires: '2024-12-31' }
 *   },
 *   oauth2Token
 * );
 *
 * // Clear all custom claims
 * await setCustomUserClaimsHandler('user789', null, oauth2Token);
 * ```
 *
 * @example
 * ```typescript
 * // Error handling
 * try {
 *   await setCustomUserClaimsHandler(userId, claims, oauth2Token);
 *   console.log('Claims set successfully');
 * } catch (error) {
 *   if (error.message.includes('Reserved claim name')) {
 *     console.error('Cannot use reserved claim names');
 *   } else if (error.message.includes('too large')) {
 *     console.error('Claims exceed 1000 byte limit');
 *   } else if (error.message.includes('Failed to set custom user claims')) {
 *     console.error('Firebase API error:', error.message);
 *   } else {
 *     console.error('Unexpected error:', error);
 *   }
 * }
 * ```
 *
 * **Important Notes:**
 * - Claims are included in new ID tokens issued after this call
 * - Existing ID tokens retain their original claims until refresh
 * - Client applications can access claims via `firebase.auth().currentUser.getIdTokenResult()`
 * - Claims persist until explicitly changed or user is deleted
 * - Maximum 1000 custom claims per user (Firebase limit)
 *
 * @package
 * @internal Used by CloudFireAuth.setCustomUserClaims()
 * @since 1.0.0
 *
 * @see {@link https://firebase.google.com/docs/auth/admin/custom-claims Firebase Custom Claims Documentation}
 * @see {@link https://firebase.google.com/docs/reference/admin/node/firebase-admin.auth.auth.md#authsetcustomuserclaims Firebase Admin SDK Reference}
 * @see {@link checkClaimsAreValid} For validation rules and restrictions
 */
export async function setCustomUserClaimsHandler(
  uid: string,
  customUserClaims: object | null,
  oauth2AccessToken: string
): Promise<void> {
  if (!checkClaimsAreValid(customUserClaims)) {
    throw new Error("Invalid custom user claims", { cause: customUserClaims });
  }

  const body = JSON.stringify({
    localId: uid,
    customAttributes: JSON.stringify(customUserClaims ?? {}),
  });

  console.log("body", body);

  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:update`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${oauth2AccessToken}`,
    },
    body,
  });

  if (!response.ok) {
    console.log("response", response);
    throw new Error(
      `Failed to set custom user claims: ${response.status} ${
        response.statusText
      }, ${await response.text()}, response: ${response}`
    );
  }

  return;
}

/**
 * Validates custom user claims for Firebase Auth compliance.
 *
 * Performs comprehensive validation to ensure custom claims meet Firebase Auth requirements:
 * - Rejects reserved Firebase Auth claim names (iss, aud, auth_time, user_id, firebase, etc.)
 * - Rejects reserved OIDC standard claim names (email, name, picture, etc.)
 * - Enforces the 1000-byte size limit for serialized claims
 * - Handles null/undefined input gracefully
 *
 * Reserved Firebase Auth claims that cannot be overridden:
 * - `iss`, `aud`, `auth_time`, `user_id`, `firebase`
 * - `iat`, `exp`, `sub`, `uid`
 *
 * Reserved OIDC claims that cannot be overridden:
 * - `email`, `email_verified`, `phone_number`, `phone_number_verified`
 * - `name`, `given_name`, `family_name`, `middle_name`, `nickname`, `preferred_username`
 * - `profile`, `picture`, `website`, `gender`, `birthdate`, `zoneinfo`, `locale`, `updated_at`
 * - `azp`, `nonce`, `at_hash`, `c_hash`
 *
 * **Size Calculation:**
 * Claims are serialized to JSON and must not exceed 1000 bytes when UTF-8 encoded.
 * This includes all property names, values, and JSON formatting characters.
 *
 * @param customUserClaims - The custom user claims object to validate.
 *                          Can be null to clear existing claims.
 *
 * @returns `true` if the claims are valid or null.
 *
 * @throws {Error} When claims violate Firebase Auth restrictions:
 *   - "Reserved claim name: {name} is not allowed in custom user claims" - Uses reserved Firebase/OIDC claim
 *   - "Custom user claims are too large. Must be less than 1000 bytes. Size: {size} bytes" - Exceeds size limit
 *   - "Failed to serialize custom user claims: {error}" - JSON serialization failed (circular refs, etc.)
 *   - Returns `false` for invalid input types (arrays, primitives, etc.)
 *
 * @example
 * ```typescript
 * // Valid claims
 * checkClaimsAreValid({ role: 'admin', permissions: ['read', 'write'] }); // → true
 * checkClaimsAreValid(null); // → true (clears claims)
 * checkClaimsAreValid({}); // → true (empty claims)
 *
 * // Invalid input types return false
 * checkClaimsAreValid([]); // → false (arrays not allowed)
 * checkClaimsAreValid("string"); // → false (primitives not allowed)
 *
 * // Invalid claims throw errors
 * try {
 *   checkClaimsAreValid({ email: 'test@example.com' });
 * } catch (error) {
 *   // Error: Reserved claim name: email is not allowed in custom user claims
 * }
 *
 * try {
 *   checkClaimsAreValid({ firebase: { tenant: 'abc' } });
 * } catch (error) {
 *   // Error: Reserved claim name: firebase is not allowed in custom user claims
 * }
 *
 * try {
 *   const largeClaims = { data: 'x'.repeat(1000) };
 *   checkClaimsAreValid(largeClaims);
 * } catch (error) {
 *   // Error: Custom user claims are too large. Must be less than 1000 bytes. Size: 1012 bytes
 * }
 * ```
 *
 * @package
 * @internal Used by setCustomUserClaims handler
 * @since 1.0.0
 *
 * @see {@link https://firebase.google.com/docs/auth/admin/custom-claims Firebase Custom Claims}
 * @see {@link https://openid.net/specs/openid-connect-core-1_0.html#IDToken OIDC ID Token Claims}
 */
export function checkClaimsAreValid(customUserClaims: object | null): boolean {
  // Null is valid (used to clear existing claims)
  if (customUserClaims === null || customUserClaims === undefined) {
    return true;
  }

  // Must be an object
  if (typeof customUserClaims !== "object" || Array.isArray(customUserClaims)) {
    return false;
  }

  const claims = customUserClaims as Record<string, any>;

  // Reserved Firebase Auth claims
  const firebaseReservedClaims = new Set([
    "iss",
    "aud",
    "auth_time",
    "user_id",
    "firebase",
    "iat",
    "exp",
    "sub",
    "uid",
  ]);

  // Reserved OIDC standard claims
  const oidcReservedClaims = new Set([
    "email",
    "email_verified",
    "phone_number",
    "phone_number_verified",
    "name",
    "given_name",
    "family_name",
    "middle_name",
    "nickname",
    "preferred_username",
    "profile",
    "picture",
    "website",
    "gender",
    "birthdate",
    "zoneinfo",
    "locale",
    "updated_at",
    "azp",
    "nonce",
    "at_hash",
    "c_hash",
  ]);

  // Check for reserved claim names
  for (const key of Object.keys(claims)) {
    if (firebaseReservedClaims.has(key) || oidcReservedClaims.has(key)) {
      throw new Error(`Reserved claim name: ${key} is not allowed in custom user claims`);
    }
  }

  // Check size limit (1000 bytes when JSON serialized)
  try {
    const serialized = JSON.stringify(claims);
    const sizeInBytes = new TextEncoder().encode(serialized).length;

    if (sizeInBytes > 1000) {
      throw new Error(`Custom user claims are too large. Must be less than 1000 bytes. Size: ${sizeInBytes} bytes`);
    }
  } catch (error) {
    // JSON serialization failed (circular references, etc.)
    throw new Error(`Failed to serialize custom user claims: ${error}`);
  }

  return true;
}
