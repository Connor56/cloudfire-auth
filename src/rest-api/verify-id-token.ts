import type { DecodedIdToken } from "../types.js";
import { decodeJwt, decodeProtectedHeader, importX509, jwtVerify } from "jose";

/**
 * Verifies a Firebase ID token (JWT) and returns its decoded claims.
 *
 * This function performs comprehensive validation of Firebase ID tokens including:
 * - JWT structure and format validation
 * - Cryptographic signature verification using Google's public keys
 * - Firebase-specific claim validation (audience, issuer, timing)
 * - Optional revocation status checking
 *
 * The verification process follows Firebase's recommended security practices:
 * 1. Validates JWT body claims (aud, iss, sub, exp, iat, auth_time)
 * 2. Validates JWT header (algorithm RS256, key ID)
 * 3. Fetches and caches Google's signing keys from their public API
 * 4. Verifies cryptographic signature using the appropriate public key
 * 5. Optionally checks if the user's tokens have been revoked
 *
 * **Key Features:**
 * - Automatic public key fetching and caching (when KV namespace provided)
 * - Proper error handling with descriptive error messages
 * - Support for revocation checking via Firebase Admin API
 * - Network error resilience
 *
 * **Security Validations:**
 * - Ensures token audience matches the provided project ID
 * - Verifies token was issued by Firebase (`https://securetoken.google.com/{projectId}`)
 * - Checks token hasn't expired and wasn't issued in the future
 * - Validates authentication time is not in the future
 * - Ensures subject (user ID) is a non-empty string
 * - Confirms token uses RS256 algorithm (not vulnerable algorithms)
 *
 * **Performance Optimizations:**
 * - Caches Google public keys in KV storage to avoid repeated API calls
 * - Respects cache headers from Google's key endpoint
 * - Fails fast on basic validation errors before expensive crypto operations
 *
 * @param idToken - The Firebase ID token (JWT) to verify. Must be a valid JWT string.
 * @param projectId - Your Firebase project ID. Used to validate token audience and issuer.
 * @param oauth2Token - OAuth2 access token for Firebase Admin API. Required for revocation checks.
 * @param kv - Optional Cloudflare KV namespace for caching Google's public keys.
 *             Improves performance by avoiding repeated key fetches.
 * @param checkRevoked - Whether to check if the token has been revoked by comparing
 *                      against the user's `tokensValidAfterTime`. Requires an additional
 *                      API call to Firebase Admin API.
 *
 * @returns A Promise that resolves to the decoded ID token containing user claims
 *          and Firebase-specific metadata. The returned object includes standard
 *          JWT claims (iss, aud, exp, iat, sub) plus Firebase-specific claims
 *          (email, email_verified, firebase, etc.).
 *
 * @throws {Error} When token validation fails:
 *   - "Token audience does not match project ID" - Wrong project ID
 *   - "Token issuer does not match project ID" - Not issued by Firebase
 *   - "Token expiration date is in the past" - Expired token
 *   - "Token issued at date is in the future" - Clock skew or forged token
 *   - "Token subject is empty" - Missing or invalid user ID
 *   - "Token algorithm is not RS256" - Unsafe algorithm
 *   - "Token key ID is not in the Google API" - Unknown or rotated key
 *   - "Token is invalid" - Signature verification failed
 *   - "Token is revoked" - User tokens were revoked (when checkRevoked=true)
 *   - Network errors when fetching Google's public keys or checking revocation
 *
 * @example
 * ```typescript
 * // Basic token verification
 * const decodedToken = await verifyIdTokenHandler(
 *   idToken,
 *   "my-project-id",
 *   oauth2Token
 * );
 * console.log("User ID:", decodedToken.uid);
 * console.log("Email:", decodedToken.email);
 *
 * // With caching and revocation checking
 * const decodedToken = await verifyIdTokenHandler(
 *   idToken,
 *   "my-project-id",
 *   oauth2Token,
 *   kvNamespace,     // Enables key caching
 *   true            // Check if token was revoked
 * );
 * ```
 *
 * @example
 * ```typescript
 * // Error handling
 * try {
 *   const decodedToken = await verifyIdTokenHandler(idToken, projectId, oauth2Token);
 *   // Token is valid, proceed with authenticated request
 *   return processAuthenticatedRequest(decodedToken);
 * } catch (error) {
 *   if (error.message.includes('expired')) {
 *     return { error: 'Please log in again' };
 *   } else if (error.message.includes('revoked')) {
 *     return { error: 'Access has been revoked' };
 *   } else {
 *     return { error: 'Invalid token' };
 *   }
 * }
 * ```
 *
 * @see {@link https://firebase.google.com/docs/auth/admin/verify-id-tokens Firebase Admin SDK Token Verification}
 * @see {@link https://tools.ietf.org/html/rfc7519 JWT RFC 7519}
 * @see {@link https://firebase.google.com/docs/reference/admin/node/firebase-admin.auth.auth.md#authverifyidtoken Firebase verifyIdToken Reference}
 *
 * @since 1.0.0
 * @package
 */
export async function verifyIdTokenHandler(
  idToken: string,
  projectId: string,
  oauth2Token: string,
  kv?: KVNamespace,
  checkRevoked?: boolean
): Promise<DecodedIdToken> {
  const { isValid: isValidBody, errorMessage: errorMessageBody } = await validateJwtBody(idToken, projectId);

  if (!isValidBody) {
    throw new Error(errorMessageBody);
  }

  const { isValid: isValidHeader, errorMessage: errorMessageHeader, signingKey } = await validateJwtHeader(idToken, kv);

  if (!isValidHeader) {
    throw new Error(errorMessageHeader);
  }

  const { isValid: tokenVerified, payload: tokenPayload } = await verifyToken(idToken, signingKey!, projectId);

  if (!tokenVerified) {
    throw new Error("Token is invalid");
  }

  const localId = tokenPayload?.sub as string;

  if (checkRevoked === true) {
    const tokenValidSinceTime = await getTokenValidSinceTime(localId, oauth2Token);

    if (tokenPayload?.iat && tokenValidSinceTime > tokenPayload.iat) {
      throw new Error("Token is revoked");
    }
  }

  return tokenPayload as DecodedIdToken;
}

/**
 * Gets the token validSince time for the user corresponding to the ID token.
 * If the token was issued before this validSince time, the token is invalid.
 * @param localId - The local ID of the user to get the token valid since time for.
 * @param oauth2Token - The OAuth2 token for the Firebase Admin API.
 * @returns The token valid since time.
 */
async function getTokenValidSinceTime(localId: string, oauth2Token: string): Promise<number> {
  const accountLookupResponse = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${oauth2Token}`,
    },
    body: JSON.stringify({ localId: [localId] }),
  });

  const accountLookupJson = (await accountLookupResponse.json()) as {
    users: Array<{ validSince: string }>;
  };

  if (!accountLookupJson.users[0]?.validSince) {
    throw new Error("Token valid since time is not a string");
  }

  return parseInt(accountLookupJson.users[0].validSince);
}

/**
 * Validates the body of a JWT. The token is expected to come from Firebase Auth,
 * because of this it has specific required fields that are checked for. If these
 * fields are not present, the token is invalid.
 *
 * @param token - The JWT to validate.
 * @returns True if the token is valid, false and an error message if the token is invalid.
 */
async function validateJwtBody(token: string, projectId: string): Promise<{ isValid: boolean; errorMessage?: string }> {
  const firebaseJwtBody: DecodedIdToken = decodeJwt(token) as DecodedIdToken;

  if (firebaseJwtBody.aud !== projectId) {
    return {
      isValid: false,
      errorMessage: `Token audience does not match project ID, expected ${projectId}, got ${firebaseJwtBody.aud}`,
    };
  }

  if (typeof firebaseJwtBody.sub !== "string") {
    return {
      isValid: false,
      errorMessage: "Token subject is not a string",
    };
  }

  if (firebaseJwtBody.sub === "") {
    return {
      isValid: false,
      errorMessage: `Token subject is empty`,
    };
  }

  if (firebaseJwtBody.iss !== `https://securetoken.google.com/${projectId}`) {
    return {
      isValid: false,
      errorMessage: `Token issuer does not match project ID, expected https://securetoken.google.com/${projectId}, got ${firebaseJwtBody.iss}`,
    };
  }

  const currentTime = Math.ceil(Date.now() / 1000);

  if (firebaseJwtBody.exp && firebaseJwtBody.exp < currentTime) {
    return { isValid: false, errorMessage: "Token expiration date is in the past" };
  }

  if (firebaseJwtBody.iat && firebaseJwtBody.iat > currentTime) {
    return { isValid: false, errorMessage: "Token issued at date is in the future" };
  }

  if (firebaseJwtBody.auth_time && typeof firebaseJwtBody.auth_time !== "number") {
    return { isValid: false, errorMessage: "Token auth time is not a number" };
  }

  if ((firebaseJwtBody.auth_time as number) > currentTime) {
    return { isValid: false, errorMessage: "Token auth time is in the future" };
  }

  return { isValid: true };
}

/**
 * Validates the header of a Firebase JWT. First checks the algorithm type is
 * the expected type, then checks the key ID is valid either by checking in the
 * KV namespace or by fetching the key from the Google API.
 *
 * If a new key is fetched from the Google API that was used to sign the token
 * then it is stored in the KV namespace for the duration of the cache time
 * returned from the Google API in the headers.
 *
 * @param token - The JWT to validate.
 * @param kv - The KV namespace to get the Google public keys from.
 * @returns True and the signing key if the token is valid, false and an error message if the token is invalid.
 */
export async function validateJwtHeader(
  token: string,
  kv?: KVNamespace
): Promise<{ isValid: boolean; errorMessage?: string; signingKey?: string }> {
  const firebaseJwtHeader = decodeProtectedHeader(token);

  // console.log("firebaseJwtHeader", firebaseJwtHeader);

  if (firebaseJwtHeader.alg !== "RS256") {
    return { isValid: false, errorMessage: "Token algorithm is not RS256" };
  }

  const expectedKeyId = `googlePublicKey-${firebaseJwtHeader.kid}`;

  if (kv) {
    const googlePublicKey = await kv.get(expectedKeyId);
    if (googlePublicKey) {
      return { isValid: true, signingKey: googlePublicKey };
    }
  }

  console.log("Token key ID is not in the KV namespace, fetching from Google API");

  const googlePublicKeys = await getGooglePublicKeys();

  const signingKey = googlePublicKeys.keys[firebaseJwtHeader.kid as string];
  if (!signingKey) {
    return { isValid: false, errorMessage: "Token key ID is not in the Google API" };
  }

  if (kv) {
    const cacheDuration = googlePublicKeys.cache_duration;
    if (cacheDuration > 0) {
      await kv.put(expectedKeyId, signingKey, { expirationTtl: cacheDuration });
    }
  }

  return { isValid: true, signingKey };
}

interface GooglePublicKeysResponse {
  keys: Record<string, string>;
  cache_duration: number; // in seconds
}

/**
 * Pulls the google public keys from the Google API and extracts the cache time
 * for the keys. Returns these in an object.
 * @returns The Google public keys.
 */
async function getGooglePublicKeys(): Promise<GooglePublicKeysResponse> {
  const googlePublicKeysResponse = await fetch(
    "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com"
  );

  console.log("googlePublicKeysResponse", googlePublicKeysResponse.status);

  const googlePublicKeysJson = await googlePublicKeysResponse.json();
  const cacheDuration = googlePublicKeysResponse.headers.get("cache-control")?.split("=")[1];

  const googlePublicKeys: GooglePublicKeysResponse = {
    keys: googlePublicKeysJson as Record<string, string>,
    cache_duration: cacheDuration ? parseInt(cacheDuration) : 0,
  };

  return googlePublicKeys;
}

/**
 * Verifies a Firebase ID token using Google' public keys, and their suggested
 * simple validation checks. You can read about these checks here:
 * https://firebase.google.com/docs/auth/admin/verify-id-tokens#verify_id_tokens_using_a_third-party_jwt_library
 * @param token - The Firebase ID token to verify
 * @returns True if the token is valid, false otherwise
 */
async function verifyToken(
  token: string,
  signingKey: string,
  projectId: string
): Promise<{ isValid: boolean; payload?: DecodedIdToken }> {
  const tokenVerificationKey = await importX509(signingKey, "RS256");

  const { payload } = await jwtVerify(token, tokenVerificationKey, {
    issuer: `https://securetoken.google.com/${projectId}`,
    audience: projectId,
  });

  console.log("Token verified");

  return { isValid: true, payload: payload as DecodedIdToken };
}
