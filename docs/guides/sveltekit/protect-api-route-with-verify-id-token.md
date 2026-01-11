# Protect API Route with verifyIdToken

This guide shows you how to protect API routes in SvelteKit using `cloudfire-auth` to verify Firebase ID tokens on the server-side.

## Installation

Install `cloudfire-auth` with:

```bash
npm install cloudfire-auth
```

## Setup

### 1. Create Server Auth Module

Create a server-side authentication module. In SvelteKit, everything within the `src/lib/server` directory is never sent to the client.

Create the following file structure:

```
📁 src/
├── 📁 lib/
│   ├── 📁 server/
│   │   ├── 📄 auth.ts
```

Add the following code to `src/lib/server/auth.ts`:

```typescript
import { CloudFireAuth } from "cloudfire-auth";
import { base64url } from "jose";

import { FIREBASE_SERVICE_ACCOUNT_KEY } from "$env/static/private";
import type { KVNamespace } from "@cloudflare/workers-types";

/**
 * Create a new CloudFireAuth instance from a service account key you have
 * stored in your environment variables.
 * @param kvNamespace KV namespace to use for the auth instance.
 * @returns CloudFireAuth instance.
 */
export function getServerAuth(kvNamespace: KVNamespace) {
  const decodedKey = base64url.decode(FIREBASE_SERVICE_ACCOUNT_KEY);

  const serviceAccountJsonString = new TextDecoder().decode(decodedKey);

  const serviceAccountKey = JSON.parse(serviceAccountJsonString);

  return new CloudFireAuth(serviceAccountKey, kvNamespace);
}
```

### 2. Understanding the Setup

- **`getServerAuth`** - This is the core exported function that creates a new instance of `CloudFireAuth` for interacting with your Firebase project.
- **`kvNamespace`** - This is a KV Namespace you need to attach to your Cloudflare project. It adds caching to your `CloudFireAuth` instance, improving performance.
- **`serviceAccountKey`** - The service account key associated with your Firebase project. This example stores it as a base64-encoded string in an environment variable, but as long as the key is passed in as a JavaScript object, it will work correctly.
- **`CloudFireAuth`** - The returned instance that lets you interact with your Firebase Authentication repository.

> **Note:** It's safe to put your service account key in an environment variable like `FIREBASE_SERVICE_ACCOUNT_KEY`, because any `.env` variable without a `PUBLIC_` prefix is private by default in SvelteKit.

## Protecting an API Endpoint

To protect an API endpoint, create a route handler that verifies the Firebase ID token before processing the request.

### 1. Create the API Route

Create a new API route:

```bash
touch src/routes/api/check-auth/+server.ts
```

### 2. Implement Token Verification

Paste this into your `+server.ts` file:

```typescript
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";
import { getServerAuth } from "$lib/server/auth";

export const GET: RequestHandler = async ({ request, platform }) => {
  try {
    // Extract the token from the cookie
    const cookie = request.headers.get("cookie");
    const token = cookie?.split("firebase-token=")[1];

    if (!token) {
      return json({ error: "No token provided" }, { status: 401 });
    }

    // Get the server auth instance
    const serverAuth = getServerAuth(platform?.env?.KV);

    // Verify the ID token
    // If the token is invalid, an error will be thrown
    const idToken = await serverAuth.verifyIdToken(token);

    // Token is valid, proceed with the request
    return json(
      {
        message: "You are authorised",
        uid: idToken.uid,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error processing request:", error);
    return json({ error: "You are not authorised" }, { status: 401 });
  }
};
```

### 3. How It Works

1. **Extract the token** - The code extracts the Firebase ID token from the `firebase-token` cookie in the request headers.
2. **Get auth instance** - Creates a `CloudFireAuth` instance using the KV namespace from your Cloudflare platform environment.
3. **Verify the token** - Calls `verifyIdToken()` which validates the token signature, expiration, and issuer. If the token is invalid, an error is thrown.
4. **Handle the response** - If verification succeeds, the request is authorized and you can proceed. If it fails, a 401 Unauthorized response is returned.

### 4. Using the Protected Endpoint

When making requests to this endpoint, ensure the Firebase ID token is included in the `firebase-token` cookie. The client should set this cookie after successful authentication.

## Additional Notes

- The `verifyIdToken()` method automatically handles token validation, including checking expiration and signature verification.
- If you're using a KV namespace, the public signing keys are cached, making subsequent verifications much faster.
- You can access the decoded token claims (like `uid`, `email`, etc.) from the `idToken` object returned by `verifyIdToken()`.
- This same pattern can be used for other HTTP methods (POST, PUT, DELETE, etc.) by exporting the corresponding handler functions.
