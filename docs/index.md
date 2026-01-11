# Cloudfire Auth

A library to make Firebase Auth work in Cloudflare Workers, using native Cloudflare APIs for caching and persistence. The library handles OAuth2 token generation and interactions with the Firebase Auth REST API.

## Features

- 🔥 Firebase Auth compatibility for Cloudflare Workers
- ⚡ Native Cloudflare KV integration for token caching
- 🛡️ Full TypeScript support
- 📦 One dependency, `jose` for JWT handling
- 🌐 ESM-only for modern JavaScript environments

## Installation

```bash
npm install cloudfire-auth
```

## Quick Start

The fastest way to start is:

1. Base64 encode your service account key.
2. Add the encoded string to your `.env` file as `FIREBASE_SERVICE_ACCOUNT_KEY`.
3. Import `CloudFireAuth` and your service account key from the environment variable.
4. Decode your service account key into a JavaScript object.
5. Initialize `CloudFireAuth` with your service account key.

> **Note:** It's safe to put your service account key in an environment variable like `FIREBASE_SERVICE_ACCOUNT_KEY`, because any `.env` variable without a `PUBLIC_` prefix is private by default in SvelteKit.

You can see this done below:

```ts
import { CloudFireAuth } from "cloudfire-auth";

const serviceAccountKey = JSON.parse(atob(process.env.FIREBASE_SERVICE_ACCOUNT_KEY));

const auth = new CloudFireAuth(serviceAccountKey);
```

That's all it takes.

### With KV Namespace

If you want to use a KV namespace for token caching, you can pass it to the constructor as the second argument.

```ts
import { CloudFireAuth } from "cloudfire-auth";

const serviceAccountKey = JSON.parse(atob(process.env.FIREBASE_SERVICE_ACCOUNT_KEY));

const auth = new CloudFireAuth(serviceAccountKey, env.YOUR_KV_NAMESPACE);
```

With this enabled, you cache Google's public signing keys, and you can verify ID tokens much faster.

## API Reference

### Constructor

```typescript
new CloudFireAuth(serviceAccountKey: ServiceAccountKey, kvNamespace?: KVNamespace)
```

- `serviceAccountKey`: Firebase service account credentials
- `kvNamespace`: Optional KV namespace for OAuth2 token caching

### Methods

The tables below represent the entire API surface of the Firebase Admin SDK. A tick or cross has been added to each to indicate whether the method is supported by this library.

You can read more about each method and see examples [here](/api/methods/index.md).

If you'd like to suggest which method should be supported next, please visit this [Discussion](https://github.com/Connor56/cloudfire-auth/discussions/1)

#### Authentication

| Method                                                                             | Status | Description                         |
| ---------------------------------------------------------------------------------- | ------ | ----------------------------------- |
| `verifyIdToken(idToken: string, checkRevoked?: boolean)`                           | ✅     | Verify Firebase ID tokens           |
| `verifySessionCookie(sessionCookie: string, checkRevoked?: boolean)`               | ❌     | Verify session cookies              |
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
