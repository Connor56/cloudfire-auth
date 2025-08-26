import { describe, it, expect } from "vitest";
import { verifyIdTokenHandler, validateJwtHeader } from "../src/rest-api/verify-id-token.js";
import { getOauth2AccessTokenHandler } from "../src/google-auth/get-oauth-2-token.js";
import serviceAccountKey from "./service-account-key.json";
import { env } from "process";
import { config } from "dotenv";
// import * as admin from "firebase-admin";

config({ path: "test/.env" });

// const serviceAccountKey = admin.initializeApp({
//   credential: admin.credential.cert(serviceAccountKey),
// });

const doNotRunIntegrationTests = env.RUN_INTEGRATION_TESTS !== "true";

describe.skipIf(doNotRunIntegrationTests)("Verify ID Token Handler Integration Test", () => {
  it("should create a custom token and verify it", async () => {
    const oauth2Token = await getOauth2AccessTokenHandler(serviceAccountKey);

    const tokenData = await addANewUserWithSignUp(oauth2Token);

    const signInData = await signInWithPassword(oauth2Token);

    await new Promise((resolve) => setTimeout(resolve, 1000));

    const decodedToken = await verifyIdTokenHandler(
      signInData.idToken,
      "full-stack-gaming-auth",
      oauth2Token,
      undefined,
      true
    );

    console.log("The decoded token is:", decodedToken);

    expect(decodedToken).toBeDefined();
    expect(decodedToken.name).toBe("test-user-123");
    expect(decodedToken.iss).toContain(serviceAccountKey.project_id);
    expect(decodedToken.email).toBe("test-user-123@example.com");
    expect(decodedToken.email_verified).toBe(false);

    deleteUser(tokenData.localId, oauth2Token);
  }, 10000);
});

/**
 * Creates a new user with a password and email sign up flow.
 * @param oauth2Token - The OAuth2 token for the Firebase Admin API.
 * @returns The custom token for the user.
 */
async function addANewUserWithSignUp(oauth2Token: string) {
  const response = await fetch("https://identitytoolkit.googleapis.com/v1/accounts:signUp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${oauth2Token}`,
    },
    body: JSON.stringify({
      email: "test-user-123@example.com",
      password: "password",
      displayName: "test-user-123",
    }),
  });

  const data = await response.json();

  return data;
}

/**
 * Signs in a user with email and password.
 * @param oauth2Token - The OAuth2 token for the Firebase Admin API.
 * @returns The sign in response data including idToken.
 */
async function signInWithPassword(oauth2Token: string) {
  const response = await fetch("https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${oauth2Token}`,
    },
    body: JSON.stringify({
      email: "test-user-123@example.com",
      password: "password",
      returnSecureToken: true,
    }),
  });

  const data = await response.json();

  return data;
}

/**
 * Deletes a user from the Firebase Auth database.
 * @param localId - The local ID of the user to delete.
 */
async function deleteUser(localId: string, oauth2Token: string) {
  const response = await fetch("https://identitytoolkit.googleapis.com/v1/accounts:delete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${oauth2Token}`,
    },
    body: JSON.stringify({
      localId: localId,
    }),
  });
}
