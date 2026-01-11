# Protect Page with verifyIdToken

This guide shows you how to protect pages in SvelteKit using `cloudfire-auth` to verify Firebase ID tokens on the server-side.

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

## Protecting a Page

To protect a page, create a `+page.server.ts` file that verifies the Firebase ID token before the page loads. If verification fails, the user will be redirected to a login page.

### 1. Create the Page Server Load Function

Create a `+page.server.ts` file in the route you want to protect. For example, to protect a feature page for paying users:

```bash
touch src/routes/feature/+page.server.ts
```

### 2. Implement Token Verification

Paste this into your `+page.server.ts` file:

```typescript
import { redirect } from "@sveltejs/kit";
import { getServerAuth } from "$lib/server/auth";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ cookies, platform }) => {
  const token = cookies.get("firebase-token");

  if (!token) {
    throw redirect(302, "/log-in");
  }

  try {
    // Get the server auth instance
    const cloudfireAuth = getServerAuth(platform?.env?.KV);

    // If the token is invalid, an error will be thrown
    await cloudfireAuth.verifyIdToken(token);

    // Token is valid, page will load normally
  } catch (error) {
    console.error("Error verifying token:", error);
    throw redirect(302, "/log-in");
  }
};
```

### 3. How It Works

1. **Extract the token** - The code extracts the Firebase ID token from the `firebase-token` cookie using SvelteKit's `cookies` API.
2. **Check for token** - If no token is present, the user is immediately redirected to the login page.
3. **Get auth instance** - Creates a `CloudFireAuth` instance using the KV namespace from your Cloudflare platform environment.
4. **Verify the token** - Calls `verifyIdToken()` which validates the token signature, expiration, and issuer. If the token is invalid, an error is thrown.
5. **Handle the response** - If verification succeeds, the page loads normally. If it fails, the user is redirected to the login page.

### 4. Using Protected Pages

When a user navigates to a protected page, the `load` function runs on the server before the page is rendered. If the Firebase ID token is missing or invalid, the user will be redirected to your login page. The client should set the `firebase-token` cookie after successful authentication.

## Additional Notes

- The `verifyIdToken()` method automatically handles token validation, including checking expiration and signature verification.
- If you're using a KV namespace, the public signing keys are cached, making subsequent verifications much faster.
- You can access the decoded token claims by storing the result of `verifyIdToken()` if you need user information in your page.
- The redirect status code `302` is a temporary redirect. You can use `301` for a permanent redirect if needed.
- This pattern works for any page route in your SvelteKit application - just add a `+page.server.ts` file with the verification logic.
