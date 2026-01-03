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
 * You can find the code taken from the Firebase Admin SDK in this location of
 * the firebase-admin 13.4.0 npm package:
 *
 * firebase-admin/lib/auth/base-auth.d.ts
 * firebase-admin/lib/app/index.d.ts
 */

import type { DecodedIdToken } from "./token-verifier.js";
import type { UserRecord } from "./user-record.js";
import type {
  CreateRequest,
  UpdateRequest,
  AuthProviderConfig,
  UpdateAuthProviderRequest,
  AuthProviderConfigFilter,
  ListProviderConfigResults,
} from "./auth-config.js";
import type { UserIdentifier } from "./identifier.js";
import type { ActionCodeSettings } from "./action-code-settings.js";
import type {
  UserImportRecord,
  UserImportOptions,
  UserImportResult,
  HashAlgorithmType,
  UserMetadataRequest,
  UserProviderRequest,
} from "./user-import.js";

export type {
  DecodedIdToken,
  UserRecord,
  CreateRequest,
  UpdateRequest,
  UserIdentifier,
  AuthProviderConfig,
  UpdateAuthProviderRequest,
  AuthProviderConfigFilter,
  ListProviderConfigResults,
  ActionCodeSettings,
  UserImportRecord,
  UserImportOptions,
  UserImportResult,
  HashAlgorithmType,
  UserMetadataRequest,
  UserProviderRequest,
};
/**
 * `FirebaseError` is a subclass of the standard JavaScript `Error` object. In
 * addition to a message string and stack trace, it contains a string code.
 */
export interface FirebaseError {
  /**
   * Error codes are strings using the following format: `"service/string-code"`.
   * Some examples include `"auth/invalid-uid"` and
   * `"messaging/invalid-recipient"`.
   *
   * While the message for a given error can change, the code will remain the same
   * between backward-compatible versions of the Firebase SDK.
   */
  code: string;
  /**
   * An explanatory message for the error that just occurred.
   *
   * This message is designed to be helpful to you, the developer. Because
   * it generally does not convey meaningful information to end users,
   * this message should not be displayed in your application.
   */
  message: string;
  /**
   * A string value containing the execution backtrace when the error originally
   * occurred.
   *
   * This information can be useful for troubleshooting the cause of the error with
   * {@link https://firebase.google.com/support | Firebase Support}.
   */
  stack?: string;
  /**
   * Returns a JSON-serializable object representation of this error.
   *
   * @returns A JSON-serializable representation of this object.
   */
  toJSON(): object;
}
/**
 * Composite type which includes both a `FirebaseError` object and an index
 * which can be used to get the errored item.
 *
 * @example
 * ```javascript
 * var registrationTokens = [token1, token2, token3];
 * admin.messaging().subscribeToTopic(registrationTokens, 'topic-name')
 *   .then(function(response) {
 *     if (response.failureCount > 0) {
 *       console.log("Following devices unsucessfully subscribed to topic:");
 *       response.errors.forEach(function(error) {
 *         var invalidToken = registrationTokens[error.index];
 *         console.log(invalidToken, error.error);
 *       });
 *     } else {
 *       console.log("All devices successfully subscribed to topic:", response);
 *     }
 *   })
 *   .catch(function(error) {
 *     console.log("Error subscribing to topic:", error);
 *   });
 *```
 */
export interface FirebaseArrayIndexError {
  /**
   * The index of the errored item within the original array passed as part of the
   * called API method.
   */
  index: number;
  /**
   * The error object.
   */
  error: FirebaseError;
}
/** Represents the result of the {@link BaseAuth.getUsers} API. */
export interface GetUsersResult {
  /**
   * Set of user records, corresponding to the set of users that were
   * requested. Only users that were found are listed here. The result set is
   * unordered.
   */
  users: UserRecord[];
  /** Set of identifiers that were requested, but not found. */
  notFound: UserIdentifier[];
}
/**
 * Interface representing the object returned from a
 * {@link BaseAuth.listUsers} operation. Contains the list
 * of users for the current batch and the next page token if available.
 */
export interface ListUsersResult {
  /**
   * The list of {@link UserRecord} objects for the
   * current downloaded batch.
   */
  users: UserRecord[];
  /**
   * The next page token if available. This is needed for the next batch download.
   */
  pageToken?: string;
}
/**
 * Represents the result of the {@link BaseAuth.deleteUsers}.
 * API.
 */
export interface DeleteUsersResult {
  /**
   * The number of user records that failed to be deleted (possibly zero).
   */
  failureCount: number;
  /**
   * The number of users that were deleted successfully (possibly zero).
   * Users that did not exist prior to calling `deleteUsers()` are
   * considered to be successfully deleted.
   */
  successCount: number;
  /**
   * A list of `FirebaseArrayIndexError` instances describing the errors that
   * were encountered during the deletion. Length of this list is equal to
   * the return value of {@link DeleteUsersResult.failureCount}.
   */
  errors: FirebaseArrayIndexError[];
}
/**
 * Interface representing the session cookie options needed for the
 * {@link BaseAuth.createSessionCookie} method.
 */
export interface SessionCookieOptions {
  /**
   * The session cookie custom expiration in milliseconds. The minimum allowed is
   * 5 minutes and the maxium allowed is 2 weeks.
   */
  expiresIn: number;
}
