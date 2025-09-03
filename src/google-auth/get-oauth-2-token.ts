import { importPKCS8, SignJWT } from "jose";

import type { ServiceAccountKey } from "../types.js";

interface Oauth2TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  scope?: string;
}

/**
 * Gets an OAuth2 access token from Google's OAuth2 server. This token is
 * required for accessing the Firebase Auth REST API via fetch requests.
 *
 * The token is stored in the KV namespace for the amount of time which is
 * shorter:
 *
 * - The provided expiration time
 * - The expiration time returned from Google's OAuth2 server
 *
 * @returns The OAuth2 access token
 */
export async function getOauth2AccessTokenHandler(
  serviceAccountKey: ServiceAccountKey,
  expiration: number = 3000, // 50 minutes
  kvNamespace?: KVNamespace
): Promise<string> {
  const signedJwt = await createSignedJwt(serviceAccountKey, expiration);

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: signedJwt,
    }),
  });

  const oauth2TokenResponse = (await response.json()) as Oauth2TokenResponse;

  const shortestExpiration = Math.min(expiration, oauth2TokenResponse.expires_in);

  if (kvNamespace) {
    await kvNamespace.put("oauth2Token", oauth2TokenResponse.access_token, {
      expiration: shortestExpiration,
    });
  }

  return oauth2TokenResponse.access_token;
}

/**
 * Creates a signed JWT using information from a service account key. The JWT
 * is sent to Google's OAuth2 server to produce an OAuth2 access token.
 *
 * The scope we're using is:
 * - https://www.googleapis.com/auth/identitytoolkit
 *
 * This scope is required for the Firebase Auth REST API.
 *
 * The JWT is valid for 50 minutes.
 *
 * @returns The signed JWT
 */
async function createSignedJwt(serviceAccountKey: ServiceAccountKey, expiration: number): Promise<string> {
  const header = {
    alg: "RS256",
    typ: "JWT",
    kid: serviceAccountKey.private_key_id,
  };

  const now = Math.floor(Date.now() / 1000);

  const claims = {
    iss: serviceAccountKey.client_email,
    scope: "https://www.googleapis.com/auth/identitytoolkit", // The scope we need for the Firebase Auth REST API
    aud: "https://oauth2.googleapis.com/token",
    exp: now + expiration,
    iat: now,
  };

  const signingKey = await importPKCS8(serviceAccountKey.private_key, "RS256");

  const jwt = new SignJWT(claims).setProtectedHeader(header).sign(signingKey);

  return jwt;
}
