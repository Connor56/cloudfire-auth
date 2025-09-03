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
import { CloudFireAuth, ServiceAccountKey } from "cloudfire-auth";

// Initialize with your Firebase project credentials
const auth = new CloudFireAuth(
  "your-firebase-project-id",
  {
    // Your Firebase service account key
    private_key: "-----BEGIN PRIVATE KEY-----\n...",
    client_email: "firebase-adminsdk-...@your-project.iam.gserviceaccount.com",
    // ... other service account fields
  },
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
new CloudFireAuth(projectId: string, serviceAccountKey: ServiceAccountKey, kvNamespace?: KVNamespace)
```

- `projectId`: Your Firebase project ID
- `serviceAccountKey`: Firebase service account credentials
- `kvNamespace`: Optional KV namespace for OAuth2 token caching

### Methods

| Category             | Method                                                               | Status | Description                          |
| -------------------- | -------------------------------------------------------------------- | ------ | ------------------------------------ |
| **Authentication**   | `verifyIdToken(idToken: string, checkRevoked?: boolean)`             | ✅     | Verify Firebase ID tokens            |
|                      | `verifySessionCookie(sessionCookie: string, checkRevoked?: boolean)` | ✅     | Verify session cookies               |
| **User Management**  | `getUser(uid: string)`                                               | ✅     | Get user by UID                      |
|                      | `getUserByEmail(email: string)`                                      | ❌     | Get user by email                    |
|                      | `getUserByPhoneNumber(phoneNumber: string)`                          | ❌     | Get user by phone number             |
|                      | `getUserByProviderUid(providerId: string, uid: string)`              | ❌     | Get user by provider UID             |
|                      | `getUsers(identifiers: UserIdentifier[])`                            | ❌     | Get users by identifiers             |
|                      | `createUser(properties: CreateRequest)`                              | ❌     | Create a new user                    |
|                      | `updateUser(uid: string, properties: UpdateRequest)`                 | ✅     | Update existing user                 |
|                      | `deleteUser(uid: string)`                                            | ✅     | Delete a user                        |
|                      | `deleteUsers(uids: string[])`                                        | ❌     | Delete multiple users                |
|                      | `listUsers(maxResults?: number, pageToken?: string)`                 | ❌     | List users with pagination           |
| **Token Management** | `revokeRefreshTokens(uid: string)`                                   | ✅     | Revoke all refresh tokens for a user |
|                      | `setCustomUserClaims(uid: string, customUserClaims: object \| null)` | ✅     | Set custom claims                    |

## Environment Setup

Your Cloudflare Worker needs these environment variables:

- `FIREBASE_PROJECT_ID`: Your Firebase project ID
- `FIREBASE_SERVICE_ACCOUNT_KEY`: JSON string of your service account key
- `AUTH_KV_NAMESPACE`: (Optional) KV namespace for token caching

## License

MIT © Connor Skelland

## Contributing

Issues and pull requests are welcome!
