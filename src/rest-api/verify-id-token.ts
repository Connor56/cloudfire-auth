import type { DecodedIdToken } from "../types.js";
import { decodeJwt, decodeProtectedHeader, importX509, jwtVerify } from "jose";

/**
 * Verifies a Firebase ID token (JWT). If the token is valid, the promise is
 * fulfilled with the token's decoded claims; otherwise, the promise is
 * rejected.
 *
 * If `checkRevoked` is set to true, first verifies whether the corresponding
 * user is disabled. If yes, an `auth/user-disabled` error is thrown. If no,
 * verifies if the session corresponding to the ID token was revoked. If the
 * corresponding user's session was invalidated, an `auth/id-token-revoked`
 * error is thrown. If not specified the check is not applied.
 *
 * See {@link https://firebase.google.com/docs/auth/admin/verify-id-tokens | Verify ID Tokens}
 * for code samples and detailed documentation.
 *
 * @param idToken - The ID token to verify.
 * @param checkRevoked - Whether to check if the ID token was revoked.
 *   This requires an extra request to the Firebase Auth backend to check
 *   the `tokensValidAfterTime` time for the corresponding user.
 *   When not specified, this additional check is not applied.
 *
 * @returns A promise fulfilled with the
 *   token's decoded claims if the ID token is valid; otherwise, a rejected
 *   promise.
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

  const accountLookupJson = await accountLookupResponse.json();
  console.log("accountLookupJson", JSON.stringify(accountLookupJson, null, 2));

  return accountLookupJson.users[0].validSince as number;
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

  console.log("just the decoded token", decodeJwt(token));

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
