# Cloudfire Auth

A library to make Firebase Auth work in Cloudflare Workers, using native Cloudflare APIs for caching and persistence. The library handles OAuth2 token generation and interactions with the Firebase Auth REST API.

## Features

- 🔥 Firebase Auth compatibility for Cloudflare Workers
- ⚡ Native Cloudflare KV integration for token caching
- 🛡️ Full TypeScript support
- 📦 One dependency, jose for JWT handling
- 🌐 ESM-only for modern JavaScript environments

## Installation

```bash
npm install cloudfire-auth
```

## Quick Start

```typescript
import { CloudFireAuth } from "cloudfire-auth";

// It is best practice to store your service account key separately and
// load it from a secure source.
const serviceAccountKey = {
  // Your Firebase service account key
  private_key: "-----BEGIN PRIVATE KEY-----\n...",
  client_email: "firebase-adminsdk-...@your-project.iam.gserviceaccount.com",
  // ... other service account fields
};

// Initialize with your Firebase project credentials
const auth = new CloudFireAuth(
  serviceAccountKey,
  env.YOUR_KV_NAMESPACE // Optional: KV namespace for token caching
);

// Verify an ID token
try {
  const decodedToken = await auth.verifyIdToken(idToken);
  console.log("User ID:", decodedToken.uid);
} catch (error) {
  console.error("Token verification failed:", error);
}

// Get user data
const user = await auth.getUser("user-uid");
console.log("User email:", user.email);
```

## API Reference

### Constructor

```typescript
new CloudFireAuth(serviceAccountKey: ServiceAccountKey, kvNamespace?: KVNamespace)
```

- `serviceAccountKey`: Firebase service account credentials
- `kvNamespace`: Optional KV namespace for OAuth2 token caching

### Methods

#### Authentication

| Method                                                                             | Status | Description                         |
| ---------------------------------------------------------------------------------- | ------ | ----------------------------------- |
| `verifyIdToken(idToken: string, checkRevoked?: boolean)`                           | ✅     | Verify Firebase ID tokens           |
| `verifySessionCookie(sessionCookie: string, checkRevoked?: boolean)`               | ✅     | Verify session cookies              |
| `createSessionCookie(idToken: string, sessionCookieOptions: SessionCookieOptions)` | ❌     | Create session cookie from ID token |
| `createCustomToken(uid: string, developerClaims?: object)`                         | ❌     | Create custom token for client SDK  |

#### User Management

| Method                                                                | Status | Description                            |
| --------------------------------------------------------------------- | ------ | -------------------------------------- |
| `getUser(uid: string)`                                                | ✅     | Get user by UID                        |
| `getUserByEmail(email: string)`                                       | ❌     | Get user by email                      |
| `getUserByPhoneNumber(phoneNumber: string)`                           | ❌     | Get user by phone number               |
| `getUserByProviderUid(providerId: string, uid: string)`               | ❌     | Get user by provider UID               |
| `getUsers(identifiers: UserIdentifier[])`                             | ❌     | Get users by identifiers               |
| `createUser(properties: CreateRequest)`                               | ❌     | Create a new user                      |
| `updateUser(uid: string, properties: UpdateRequest)`                  | ✅     | Update existing user                   |
| `deleteUser(uid: string)`                                             | ✅     | Delete a user                          |
| `deleteUsers(uids: string[])`                                         | ❌     | Delete multiple users                  |
| `listUsers(maxResults?: number, pageToken?: string)`                  | ❌     | List users with pagination             |
| `importUsers(users: UserImportRecord[], options?: UserImportOptions)` | ❌     | Bulk import users with password hashes |

#### Token Management

| Method                                                               | Status | Description                          |
| -------------------------------------------------------------------- | ------ | ------------------------------------ |
| `revokeRefreshTokens(uid: string)`                                   | ✅     | Revoke all refresh tokens for a user |
| `setCustomUserClaims(uid: string, customUserClaims: object \| null)` | ✅     | Set custom claims                    |

#### Email Actions

| Method                                                                                                       | Status | Description                             |
| ------------------------------------------------------------------------------------------------------------ | ------ | --------------------------------------- |
| `generatePasswordResetLink(email: string, actionCodeSettings?: ActionCodeSettings)`                          | ❌     | Generate password reset link            |
| `generateEmailVerificationLink(email: string, actionCodeSettings?: ActionCodeSettings)`                      | ❌     | Generate email verification link        |
| `generateVerifyAndChangeEmailLink(email: string, newEmail: string, actionCodeSettings?: ActionCodeSettings)` | ❌     | Generate email change verification link |
| `generateSignInWithEmailLink(email: string, actionCodeSettings: ActionCodeSettings)`                         | ❌     | Generate sign-in with email link        |

#### Provider Configuration

| Method                                                                               | Status | Description                            |
| ------------------------------------------------------------------------------------ | ------ | -------------------------------------- |
| `listProviderConfigs(options: AuthProviderConfigFilter)`                             | ❌     | List SAML/OIDC provider configurations |
| `getProviderConfig(providerId: string)`                                              | ❌     | Get provider configuration by ID       |
| `createProviderConfig(config: AuthProviderConfig)`                                   | ❌     | Create new provider configuration      |
| `updateProviderConfig(providerId: string, updatedConfig: UpdateAuthProviderRequest)` | ❌     | Update provider configuration          |
| `deleteProviderConfig(providerId: string)`                                           | ❌     | Delete provider configuration          |

## Environment Setup

Your Cloudflare Worker needs these environment variables:

- `FIREBASE_SERVICE_ACCOUNT_KEY`: JSON string of your service account key
- `AUTH_KV_NAMESPACE`: (Optional) KV namespace for token caching

## License

MIT © Connor Skelland

## Contributing

Issues and pull requests are welcome!
