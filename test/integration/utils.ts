/**
 * Revokes all refresh tokens for a user, making their existing ID tokens invalid
 * when checkRevoked=true is used.
 * @param localId - The local ID of the user
 * @param oauth2Token - The OAuth2 token for the Firebase Admin API
 */
export async function revokeUserRefreshTokens(localId: string, oauth2Token: string): Promise<void> {
  const newValidSince = Math.floor(Date.now() / 1000).toString();
  console.log("revoking user refresh tokens for", localId, "with new validSince", newValidSince);
  const response = await fetch("https://identitytoolkit.googleapis.com/v1/accounts:update", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${oauth2Token}`,
    },
    body: JSON.stringify({
      localId: localId,
      validSince: newValidSince,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to revoke tokens: ${response.status} ${response.statusText}, ${await response.text()}`);
  }
}

/**
 * Creates a new user with a password and email sign up flow.
 * @param oauth2Token - The OAuth2 token for the Firebase Admin API.
 * @returns The custom token for the user.
 */
export async function addANewUserWithSignUp(oauth2Token: string) {
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
export async function signInWithPassword(oauth2Token: string) {
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
export async function deleteUser(localId: string, oauth2Token: string) {
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
