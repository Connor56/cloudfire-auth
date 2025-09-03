/*! firebase-admin v13.4.0 */
/*!
 * Copyright 2021 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Alterations to Firebase Admin SDK Code
 *
 * The code covered by the above notice in this file are the method names inside of
 * the CloudFireAuth class and their corresponding doc headers. The code inside each
 * of the methods is under the MIT License attached to this project.
 *
 * Furthermore the following class methods and their doc headers are also under the MIT
 * license:
 *
 * - getOauth2AccessToken
 *
 */
import type {
  DecodedIdToken,
  UserRecord,
  UserIdentifier,
  GetUsersResult,
  ListUsersResult,
  CreateRequest,
  UpdateRequest,
  DeleteUsersResult,
  ServiceAccountKey,
} from "./types.js";

// Rest API
import { verifyIdTokenHandler } from "./rest-api/verify-id-token.js";
import { getUserHandler } from "./rest-api/get-user.js";
import { getUserByEmailHandler } from "./rest-api/get-user-by-email.js";
import { getUserByPhoneNumberHandler } from "./rest-api/get-user-by-phone-number.js";
import { getUserByProviderUidHandler } from "./rest-api/get-user-by-provider-uid.js";
import { getUsersHandler } from "./rest-api/get-users.js";
import { listUsersHandler } from "./rest-api/list-users.js";
import { createUserHandler } from "./rest-api/create-user.js";
import { deleteUserHandler } from "./rest-api/delete-user.js";
import { deleteUsersHandler } from "./rest-api/delete-users.js";
import { updateUserHandler } from "./rest-api/update-user.js";
import { setCustomUserClaimsHandler } from "./rest-api/set-custom-user-claims.js";
import { revokeRefreshTokensHandler } from "./rest-api/revoke-refresh-tokens.js";
import { verifySessionCookieHandler } from "./rest-api/verify-session-cookie.js";

// Google Auth
import { getOauth2AccessTokenHandler } from "./google-auth/get-oauth-2-token.js";

export class CloudFireAuth {
  private projectId: string;
  private serviceAccountKey: ServiceAccountKey;
  private oauth2Token?: string;
  private kvNamespace?: KVNamespace;

  constructor(projectId: string, serviceAccountKey: ServiceAccountKey, kvNamespace?: KVNamespace) {
    this.projectId = projectId;
    this.serviceAccountKey = serviceAccountKey;
    this.kvNamespace = kvNamespace;
  }
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
  async verifyIdToken(idToken: string, checkRevoked?: boolean): Promise<DecodedIdToken> {
    const oauth2Token = await this.getOauth2AccessToken();
    return await verifyIdTokenHandler(idToken, this.projectId, oauth2Token, this.kvNamespace, checkRevoked);
  }
  /**
   * Gets the user data for the user corresponding to a given `uid`.
   *
   * See {@link https://firebase.google.com/docs/auth/admin/manage-users#retrieve_user_data | Retrieve user data}
   * for code samples and detailed documentation.
   *
   * @param uid - The `uid` corresponding to the user whose data to fetch.
   *
   * @returns A promise fulfilled with the user
   *   data corresponding to the provided `uid`.
   */
  async getUser(uid: string): Promise<UserRecord> {
    const oauth2Token = await this.getOauth2AccessToken();
    return await getUserHandler(uid, oauth2Token);
  }
  /**
   * Gets the user data for the user corresponding to a given email.
   *
   * See {@link https://firebase.google.com/docs/auth/admin/manage-users#retrieve_user_data | Retrieve user data}
   * for code samples and detailed documentation.
   *
   * @param email - The email corresponding to the user whose data to
   *   fetch.
   *
   * @returns A promise fulfilled with the user
   *   data corresponding to the provided email.
   */
  async getUserByEmail(email: string): Promise<UserRecord> {
    return await getUserByEmailHandler(email);
  }
  /**
   * Gets the user data for the user corresponding to a given phone number. The
   * phone number has to conform to the E.164 specification.
   *
   * See {@link https://firebase.google.com/docs/auth/admin/manage-users#retrieve_user_data | Retrieve user data}
   * for code samples and detailed documentation.
   *
   * @param phoneNumber - The phone number corresponding to the user whose
   *   data to fetch.
   *
   * @returns A promise fulfilled with the user
   *   data corresponding to the provided phone number.
   */
  async getUserByPhoneNumber(phoneNumber: string): Promise<UserRecord> {
    return await getUserByPhoneNumberHandler(phoneNumber);
  }
  /**
   * Gets the user data for the user corresponding to a given provider id.
   *
   * See {@link https://firebase.google.com/docs/auth/admin/manage-users#retrieve_user_data | Retrieve user data}
   * for code samples and detailed documentation.
   *
   * @param providerId - The provider ID, for example, "google.com" for the
   *   Google provider.
   * @param uid - The user identifier for the given provider.
   *
   * @returns A promise fulfilled with the user data corresponding to the
   *   given provider id.
   */
  async getUserByProviderUid(providerId: string, uid: string): Promise<UserRecord> {
    return await getUserByProviderUidHandler(providerId, uid);
  }
  /**
   * Gets the user data corresponding to the specified identifiers.
   *
   * There are no ordering guarantees; in particular, the nth entry in the result list is not
   * guaranteed to correspond to the nth entry in the input parameters list.
   *
   * Only a maximum of 100 identifiers may be supplied. If more than 100 identifiers are supplied,
   * this method throws a FirebaseAuthError.
   *
   * @param identifiers - The identifiers used to indicate which user records should be returned.
   *     Must not have more than 100 entries.
   * @returns A promise that resolves to the corresponding user records.
   * @throws FirebaseAuthError If any of the identifiers are invalid or if more than 100
   *     identifiers are specified.
   */
  async getUsers(identifiers: UserIdentifier[]): Promise<GetUsersResult> {
    return await getUsersHandler(identifiers);
  }
  /**
   * Retrieves a list of users (single batch only) with a size of `maxResults`
   * starting from the offset as specified by `pageToken`. This is used to
   * retrieve all the users of a specified project in batches.
   *
   * See {@link https://firebase.google.com/docs/auth/admin/manage-users#list_all_users | List all users}
   * for code samples and detailed documentation.
   *
   * @param maxResults - The page size, 1000 if undefined. This is also
   *   the maximum allowed limit.
   * @param pageToken - The next page token. If not specified, returns
   *   users starting without any offset.
   * @returns A promise that resolves with
   *   the current batch of downloaded users and the next page token.
   */
  async listUsers(maxResults?: number, pageToken?: string): Promise<ListUsersResult> {
    return await listUsersHandler(maxResults, pageToken);
  }
  /**
   * Creates a new user.
   *
   * See {@link https://firebase.google.com/docs/auth/admin/manage-users#create_a_user | Create a user}
   * for code samples and detailed documentation.
   *
   * @param properties - The properties to set on the
   *   new user record to be created.
   *
   * @returns A promise fulfilled with the user
   *   data corresponding to the newly created user.
   */
  async createUser(properties: CreateRequest): Promise<UserRecord> {
    return await createUserHandler(properties);
  }
  /**
   * Deletes an existing user.
   *
   * See {@link https://firebase.google.com/docs/auth/admin/manage-users#delete_a_user | Delete a user}
   * for code samples and detailed documentation.
   *
   * @param uid - The `uid` corresponding to the user to delete.
   *
   * @returns An empty promise fulfilled once the user has been
   *   deleted.
   */
  async deleteUser(uid: string): Promise<void> {
    const oauth2Token = await this.getOauth2AccessToken();
    await deleteUserHandler(uid, oauth2Token);
  }
  /**
   * Deletes the users specified by the given uids.
   *
   * Deleting a non-existing user won't generate an error (i.e. this method
   * is idempotent.) Non-existing users are considered to be successfully
   * deleted, and are therefore counted in the
   * `DeleteUsersResult.successCount` value.
   *
   * Only a maximum of 1000 identifiers may be supplied. If more than 1000
   * identifiers are supplied, this method throws a FirebaseAuthError.
   *
   * This API is currently rate limited at the server to 1 QPS. If you exceed
   * this, you may get a quota exceeded error. Therefore, if you want to
   * delete more than 1000 users, you may need to add a delay to ensure you
   * don't go over this limit.
   *
   * @param uids - The `uids` corresponding to the users to delete.
   *
   * @returns A Promise that resolves to the total number of successful/failed
   *     deletions, as well as the array of errors that corresponds to the
   *     failed deletions.
   */
  async deleteUsers(uids: string[]): Promise<DeleteUsersResult> {
    return await deleteUsersHandler(uids);
  }
  /**
   * Updates an existing user.
   *
   * See {@link https://firebase.google.com/docs/auth/admin/manage-users#update_a_user | Update a user}
   * for code samples and detailed documentation.
   *
   * @param uid - The `uid` corresponding to the user to update.
   * @param properties - The properties to update on
   *   the provided user.
   *
   * @returns A promise fulfilled with the
   *   updated user data.
   */
  async updateUser(uid: string, properties: UpdateRequest): Promise<UserRecord> {
    const oauth2Token = await this.getOauth2AccessToken();
    return await updateUserHandler(uid, properties, oauth2Token);
  }
  /**
   * Sets additional developer claims on an existing user identified by the
   * provided `uid`, typically used to define user roles and levels of
   * access. These claims should propagate to all devices where the user is
   * already signed in (after token expiration or when token refresh is forced)
   * and the next time the user signs in. If a reserved OIDC claim name
   * is used (sub, iat, iss, etc), an error is thrown. They are set on the
   * authenticated user's ID token JWT.
   *
   * See {@link https://firebase.google.com/docs/auth/admin/custom-claims |
   * Defining user roles and access levels}
   * for code samples and detailed documentation.
   *
   * @param uid - The `uid` of the user to edit.
   * @param customUserClaims - The developer claims to set. If null is
   *   passed, existing custom claims are deleted. Passing a custom claims payload
   *   larger than 1000 bytes will throw an error. Custom claims are added to the
   *   user's ID token which is transmitted on every authenticated request.
   *   For profile non-access related user attributes, use database or other
   *   separate storage systems.
   * @returns A promise that resolves when the operation completes
   *   successfully.
   */
  async setCustomUserClaims(uid: string, customUserClaims: object | null): Promise<void> {
    const oauth2Token = await this.getOauth2AccessToken();
    await setCustomUserClaimsHandler(uid, customUserClaims, oauth2Token);
  }
  /**
   * Revokes all refresh tokens for an existing user.
   *
   * This API will update the user's {@link UserRecord.tokensValidAfterTime} to
   * the current UTC. It is important that the server on which this is called has
   * its clock set correctly and synchronized.
   *
   * While this will revoke all sessions for a specified user and disable any
   * new ID tokens for existing sessions from getting minted, existing ID tokens
   * may remain active until their natural expiration (one hour). To verify that
   * ID tokens are revoked, use {@link BaseAuth.verifyIdToken}
   * where `checkRevoked` is set to true.
   *
   * @param uid - The `uid` corresponding to the user whose refresh tokens
   *   are to be revoked.
   *
   * @returns An empty promise fulfilled once the user's refresh
   *   tokens have been revoked.
   */
  async revokeRefreshTokens(uid: string): Promise<void> {
    const oauth2Token = await this.getOauth2AccessToken();
    return await revokeRefreshTokensHandler(uid, oauth2Token);
  }
  /**
   * Verifies a Firebase session cookie. Returns a Promise with the cookie claims.
   * Rejects the promise if the cookie could not be verified.
   *
   * If `checkRevoked` is set to true, first verifies whether the corresponding
   * user is disabled: If yes, an `auth/user-disabled` error is thrown. If no,
   * verifies if the session corresponding to the session cookie was revoked.
   * If the corresponding user's session was invalidated, an
   * `auth/session-cookie-revoked` error is thrown. If not specified the check
   * is not performed.
   *
   * See {@link https://firebase.google.com/docs/auth/admin/manage-cookies#verify_session_cookie_and_check_permissions |
   * Verify Session Cookies}
   * for code samples and detailed documentation
   *
   * @param sessionCookie - The session cookie to verify.
   * @param checkForRevocation -  Whether to check if the session cookie was
   *   revoked. This requires an extra request to the Firebase Auth backend to
   *   check the `tokensValidAfterTime` time for the corresponding user.
   *   When not specified, this additional check is not performed.
   *
   * @returns A promise fulfilled with the
   *   session cookie's decoded claims if the session cookie is valid; otherwise,
   *   a rejected promise.
   */
  async verifySessionCookie(sessionCookie: string, checkRevoked?: boolean): Promise<DecodedIdToken> {
    return await verifySessionCookieHandler(sessionCookie, checkRevoked);
  }

  /**
   * Gets an OAuth2 access token from Google's OAuth2 server. This token is
   * required for accessing the Firebase Auth REST API via fetch requests.
   *
   * Checks if a token already exists in the KV namespace. If not, it gets a new
   * token from Google's OAuth2 server, and sets it on the KV namespace.¨
   *
   * This code is under the MIT Licence.
   *
   * @returns The OAuth2 access token
   */
  private async getOauth2AccessToken() {
    if (this.oauth2Token) {
      return this.oauth2Token;
    }

    let token: string | null = null;

    if (this.kvNamespace) {
      token = await this.kvNamespace?.get("oauth2Token");
    }

    if (!token) {
      // Sets the token on the KV namespace
      token = await getOauth2AccessTokenHandler(this.serviceAccountKey, 3000, this.kvNamespace);
    }

    this.oauth2Token = token;

    return token;
  }
}
