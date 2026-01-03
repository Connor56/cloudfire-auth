import type {
  DecodedIdToken,
  UserRecord,
  UserIdentifier,
  GetUsersResult,
  ListUsersResult,
  CreateRequest,
  UpdateRequest,
  DeleteUsersResult,
  SessionCookieOptions,
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
} from "./types/firebase-admin/index.js";
import type { ServiceAccountKey } from "./types/service-account-key.js";
import type { SetAccountInfoResponse } from "./types/google-auth.js";

export type {
  DecodedIdToken,
  UserRecord,
  UserIdentifier,
  GetUsersResult,
  ListUsersResult,
  CreateRequest,
  UpdateRequest,
  DeleteUsersResult,
  SessionCookieOptions,
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

export type { ServiceAccountKey };
export type { SetAccountInfoResponse };
