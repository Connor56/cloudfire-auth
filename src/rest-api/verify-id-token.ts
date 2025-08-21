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
  oauth2Token: string,
  kv?: KVNamespace,
  checkRevoked?: boolean
): Promise<DecodedIdToken> {
  return new Promise(async (resolve, reject) => {
    return resolve("hi");
    const { isValid: isValidBody, errorMessage: errorMessageBody } = await validateJwtBody(idToken);

    if (!isValidBody) {
      reject(new Error(errorMessageBody));
    }

    const { isValid: isValidHeader, errorMessage: errorMessageHeader, keyId } = await validateJwtHeader(idToken);

    if (!isValidHeader) {
      reject(new Error(errorMessageHeader));
    }

    const GooglePublicKeys = await getGooglePublicKeys(kv, keyId);

    const { isValid: tokenVerified, payload: tokenPayload } = await verifyToken(idToken, GooglePublicKeys);

    if (!tokenVerified) {
      reject(new Error("Token is invalid"));
    }

    resolve(tokenPayload as DecodedIdToken);
  });
}

/**
 * Gets the Google public keys from the KV namespace or from the Google API.
 * If the key doesn't exist in the KV namespace, the Google API is queried and
 * the result is stored in the KV namespace.
 * @param kv - The KV namespace to get the Google public keys from.
 * @param keyId - The key ID that was used to sign the token in question.
 * @returns The Google public keys.
 */
async function getGooglePublicKeys(kv?: KVNamespace, keyId?: string): Promise<Record<string, string>> {
  if (kv) {
    const googlePublicKeys = await kv.get(`googlePublicKeys-${keyId}`);
    if (googlePublicKeys) {
      return JSON.parse(googlePublicKeys);
    }
  }

  const googlePublicKeys = await fetch(
    "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com"
  );

  const googlePublicKeysJson = await googlePublicKeys.json();

  return googlePublicKeysJson;
}

/**
 * Validates the body of a JWT token.
 * @param token - The JWT token to validate.
 * @returns True if the token is valid, false and an error message if the token is invalid.
 */
async function validateJwtBody(token: string): Promise<{ isValid: boolean; errorMessage?: string }> {
  const firebaseJwtBody = decodeJwt(token);

  if (firebaseJwtBody.aud !== this.projectId) {
    return {
      isValid: false,
      errorMessage: `Token audience does not match project ID, expected ${this.projectId}, got ${firebaseJwtBody.aud}`,
    };
  }

  if (typeof firebaseJwtBody.sub !== "string") {
    return { isValid: false, errorMessage: "Token subject is not a string" };
  }
}

async function validateJwtHeader(token: string): Promise<{ isValid: boolean; errorMessage?: string }> {
  const firebaseJwtHeader = decodeProtectedHeader(token);
}

/**
 * Verifies a Firebase ID token using Google' public keys, and their suggested
 * simple validation checks. You can read about these checks here:
 * https://firebase.google.com/docs/auth/admin/verify-id-tokens#verify_id_tokens_using_a_third-party_jwt_library
 * @param token - The Firebase ID token to verify
 * @returns True if the token is valid, false otherwise
 */
async function verifyToken(token: string): Promise<{ isValid: boolean; payload?: JWTPayload }> {
  const firebaseJwtBody = decodeJwt(token);

  let { isValid, errorMessage } = this.validateTokenBody(firebaseJwtBody);
  if (!isValid) {
    console.error("token body is invalid", errorMessage);
    return { isValid: false };
  }

  console.log("token body is valid");

  const firebaseJwtHeader = decodeProtectedHeader(token);

  ({ isValid, errorMessage } = this.validateTokenHeader(firebaseJwtHeader));
  if (!isValid) {
    console.error("token header is invalid", errorMessage);
    return { isValid: false };
  }

  console.log("token header is valid");

  const allGooglesPublicKeysResponse = await fetch(
    "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com"
  );
  const allGooglesPublicKeys = await allGooglesPublicKeysResponse.json();

  const keyIdInTokenHeader = firebaseJwtHeader.kid as string;

  const isTokenKeyIdInGoogleKeys = Object.keys(allGooglesPublicKeys).includes(keyIdInTokenHeader);
  if (!isTokenKeyIdInGoogleKeys) {
    return { isValid: false };
  }

  console.log("token key id is in google keys");

  const keyIdValue = allGooglesPublicKeys[keyIdInTokenHeader];
  const tokenVerificationKey = await importX509(keyIdValue, "RS256");

  const { payload } = await jwtVerify(token, tokenVerificationKey, {
    issuer: `https://securetoken.google.com/${this.projectId}`,
    audience: this.projectId,
  });

  console.log("token has been verified");

  return { isValid: true, payload };
}

/**
 * Checks the body of the token to ensure it contains valid values set by
 * Firebase Auth
 * @param decodedToken - The decoded token
 * @returns True if the token is valid, false otherwise
 */
function validateTokenBody(decodedToken: JWTPayload): { isValid: boolean; errorMessage?: string } {
  if (decodedToken.aud !== this.projectId) {
    return {
      isValid: false,
      errorMessage: `Token audience does not match project ID, expected ${this.projectId}, got ${decodedToken.aud}`,
    };
  }

  if (typeof decodedToken.sub !== "string") {
    return {
      isValid: false,
      errorMessage: "Token subject is not a string",
    };
  }

  if (decodedToken.sub === "") {
    return {
      isValid: false,
      errorMessage: `Token subject is empty`,
    };
  }

  if (decodedToken.iss !== `https://securetoken.google.com/${this.projectId}`) {
    return {
      isValid: false,
      errorMessage: `Token issuer does not match project ID, expected https://securetoken.google.com/${this.projectId}, got ${decodedToken.iss}`,
    };
  }

  if (decodedToken.exp && decodedToken.exp < Date.now() / 1000) {
    return { isValid: false, errorMessage: "Token expiration date is in the past" };
  }

  if (decodedToken.iat && decodedToken.iat > Date.now() / 1000) {
    return { isValid: false, errorMessage: "Token issued at date is in the future" };
  }

  if (decodedToken.auth_time && typeof decodedToken.auth_time !== "number") {
    return { isValid: false, errorMessage: "Token auth time is not a number" };
  }

  if ((decodedToken.auth_time as number) > Date.now() / 1000) {
    return { isValid: false, errorMessage: "Token auth time is in the future" };
  }

  return { isValid: true };
}

/**
 * Checks the header of the token to ensure it contains valid values set by
 * Firebase Auth
 * @param protectedHeader - The protected header
 * @returns True if the header is valid, false otherwise
 */
function validateTokenHeader(protectedHeader: ProtectedHeaderParameters): {
  isValid: boolean;
  errorMessage?: string;
} {
  if (protectedHeader.alg !== "RS256") {
    return { isValid: false, errorMessage: "Token algorithm is not RS256" };
  }

  if (protectedHeader.typ !== "JWT") {
    return { isValid: false, errorMessage: "Token type is not JWT" };
  }

  if (protectedHeader.kid === undefined) {
    return { isValid: false, errorMessage: "Token key ID is undefined" };
  }

  return { isValid: true };
}

/**
 * Decodes a JWT token without verifying its signature
 */
function decodeToken(token: string): JWTPayload | null {
  try {
    return decodeJwt(token);
  } catch (error) {
    console.error("Error decoding token:", error);
    return null;
  }
}
