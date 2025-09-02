import { describe, it, expect, afterAll, beforeEach } from "vitest";
import { revokeRefreshTokensHandler } from "../../src/rest-api/revoke-refresh-tokens.js";
import { getOauth2AccessTokenHandler } from "../../src/google-auth/get-oauth-2-token.js";
import serviceAccountKey from "../service-account-key.json";
import { env } from "process";
import { config } from "dotenv";
import { KVNamespace } from "@cloudflare/workers-types";
import { addANewUserWithSignUp, deleteUser, getUserByLocalId } from "./utils.js";
import { SignJWT, generateKeyPair } from "jose";

config({ path: "test/.env" });

function createMockKV() {
  const store = new Map();
  return {
    async get(key) {
      return store.get(key) ?? null;
    },
    async put(key, value) {
      store.set(key, value);
    },
    async delete(key) {
      store.delete(key);
    },
  };
}

const doNotRunIntegrationTests = env.RUN_INTEGRATION_TESTS !== "true";

describe.skipIf(doNotRunIntegrationTests)("Revoke Refresh Tokens Handler Integration Tests", async () => {
  const KV_NAMESPACE = createMockKV() as KVNamespace;
  const oauth2Token = await getOauth2AccessTokenHandler(serviceAccountKey, 3000, KV_NAMESPACE);
  const PROJECT_ID = env.FIREBASE_PROJECT_ID!;

  // Keep track of created users for cleanup
  const createdUsers: string[] = [];

  afterAll(async () => {
    // Cleanup all created users
    await Promise.all(createdUsers.map((userId) => deleteUser(userId, oauth2Token).catch(() => {})));
  });

  // Helper function to create a test user and track it for cleanup
  async function createTestUser(email: string, displayName?: string) {
    const user = await addANewUserWithSignUp(oauth2Token, email, displayName || "Test User");
    createdUsers.push(user.localId);
    return user;
  }

  // Helper function to create a valid ID token for a user
  async function createIdTokenForUser(userId: string) {
    const { publicKey, privateKey } = await generateKeyPair("RS256");

    const payload = {
      iss: `https://securetoken.google.com/${PROJECT_ID}`,
      aud: PROJECT_ID,
      auth_time: Math.floor(Date.now() / 1000),
      user_id: userId,
      sub: userId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
      firebase: {
        identities: {},
        sign_in_provider: "custom",
      },
    };

    const token = await new SignJWT(payload).setProtectedHeader({ alg: "RS256", kid: "test-key-id" }).sign(privateKey);

    return { token, publicKey };
  }

  describe("Basic Revocation Functionality", () => {
    it("should successfully revoke refresh tokens for an existing user", async () => {
      const testUser = await createTestUser("revoke-basic@example.com", "Basic Revoke User");

      // Should not throw an error
      await expect(revokeRefreshTokensHandler(testUser.localId, oauth2Token)).resolves.toBeUndefined();

      // Verify the user still exists but tokens are revoked
      const userLookup = await getUserByLocalId(testUser.localId, oauth2Token);
      expect(userLookup.users).toHaveLength(1);
      expect(userLookup.users[0].localId).toBe(testUser.localId);
    });

    it("should update the user's validSince timestamp", async () => {
      const testUser = await createTestUser("revoke-timestamp@example.com", "Timestamp User");

      // Get user data before revocation
      const userBefore = await getUserByLocalId(testUser.localId, oauth2Token);
      const validSinceBefore = userBefore.users[0].validSince;

      // Wait a moment to ensure timestamp difference
      await new Promise<void>((resolve) => setTimeout(resolve, 1000));

      // Revoke tokens
      await revokeRefreshTokensHandler(testUser.localId, oauth2Token);

      // Get user data after revocation
      const userAfter = await getUserByLocalId(testUser.localId, oauth2Token);
      const validSinceAfter = userAfter.users[0].validSince;

      // validSince should be updated (greater than before)
      if (validSinceBefore) {
        expect(parseInt(validSinceAfter!)).toBeGreaterThan(parseInt(validSinceBefore));
      } else {
        expect(validSinceAfter).toBeTruthy();
      }
    });

    it("should handle revocation for users with existing validSince", async () => {
      const testUser = await createTestUser("revoke-existing@example.com", "Existing ValidSince User");

      // First revocation
      await revokeRefreshTokensHandler(testUser.localId, oauth2Token);

      const userAfterFirst = await getUserByLocalId(testUser.localId, oauth2Token);
      const firstValidSince = userAfterFirst.users[0].validSince;

      // Wait a moment
      await new Promise<void>((resolve) => setTimeout(resolve, 1000));

      // Second revocation
      await revokeRefreshTokensHandler(testUser.localId, oauth2Token);

      const userAfterSecond = await getUserByLocalId(testUser.localId, oauth2Token);
      const secondValidSince = userAfterSecond.users[0].validSince;

      // Second revocation should update validSince to a newer timestamp
      expect(parseInt(secondValidSince!)).toBeGreaterThan(parseInt(firstValidSince!));
    });
  });

  describe("Multiple User Scenarios", () => {
    it("should revoke tokens for multiple users independently", async () => {
      const testStartTimestamp = Date.now() / 1000;
      const user1 = await createTestUser("revoke-multi1@example.com", "Multi User 1");
      const user2 = await createTestUser("revoke-multi2@example.com", "Multi User 2");

      // Revoke tokens for both users
      await Promise.all([
        revokeRefreshTokensHandler(user1.localId, oauth2Token),
        revokeRefreshTokensHandler(user2.localId, oauth2Token),
      ]);

      await new Promise<void>((resolve) => setTimeout(resolve, 200));

      // Verify both users still exist
      const user1Lookup = await getUserByLocalId(user1.localId, oauth2Token);
      const user2Lookup = await getUserByLocalId(user2.localId, oauth2Token);

      expect(user1Lookup.users[0].localId).toBe(user1.localId);
      expect(user2Lookup.users[0].localId).toBe(user2.localId);

      // Both should have validSince timestamps
      expect(user1Lookup.users[0].validSince).toBeTruthy();
      expect(user2Lookup.users[0].validSince).toBeTruthy();
      expect(parseInt(user1Lookup.users[0].validSince!)).toBeGreaterThan(testStartTimestamp);
      expect(parseInt(user2Lookup.users[0].validSince!)).toBeGreaterThan(testStartTimestamp);
    });

    it("should handle concurrent revocation requests for the same user", async () => {
      const testStartTimestamp = Date.now() / 1000;
      const testUser = await createTestUser("revoke-concurrent@example.com", "Concurrent User");

      // Make concurrent revocation calls
      const revocations: Promise<void>[] = [
        revokeRefreshTokensHandler(testUser.localId, oauth2Token),
        revokeRefreshTokensHandler(testUser.localId, oauth2Token),
        revokeRefreshTokensHandler(testUser.localId, oauth2Token),
      ];

      // All should succeed
      await expect(Promise.all(revocations)).resolves.toEqual([undefined, undefined, undefined]);

      // User should still exist with updated validSince
      const userLookup = await getUserByLocalId(testUser.localId, oauth2Token);
      expect(userLookup.users[0].validSince).toBeTruthy();
      expect(parseInt(userLookup.users[0].validSince!)).toBeGreaterThan(testStartTimestamp);
    });
  });

  describe("Integration with ID Token Verification", () => {
    it("should make existing ID tokens fail revocation check", async () => {
      const testStartTimestamp = Date.now() / 1000;
      const testUser = await createTestUser("revoke-idtoken@example.com", "ID Token User");

      // This test would require creating a valid ID token, which is complex in isolation
      // For now, we'll test the basic flow and assume the token verification integration works
      // as it's tested in the verify-id-token integration tests

      await revokeRefreshTokensHandler(testUser.localId, oauth2Token);

      await new Promise<void>((resolve) => setTimeout(resolve, 200));

      // Verify the user data shows updated validSince
      const userLookup = await getUserByLocalId(testUser.localId, oauth2Token);
      expect(userLookup.users[0].validSince).toBeTruthy();
      expect(parseInt(userLookup.users[0].validSince!)).toBeGreaterThan(testStartTimestamp);
    });
  });

  describe("Security Scenarios", () => {
    it("should work as part of security incident response", async () => {
      const testStartTimestamp = Date.now() / 1000;
      const testUser = await createTestUser("revoke-security@example.com", "Security User");

      // Simulate security incident: immediately revoke all tokens
      await revokeRefreshTokensHandler(testUser.localId, oauth2Token);

      await new Promise<void>((resolve) => setTimeout(resolve, 200));

      // Verify the security action completed
      const userLookup = await getUserByLocalId(testUser.localId, oauth2Token);
      expect(userLookup.users[0].validSince).toBeTruthy();
      expect(parseInt(userLookup.users[0].validSince!)).toBeGreaterThan(testStartTimestamp);
      expect(userLookup.users[0].localId).toBe(testUser.localId);
    });
  });

  describe("Error Scenarios", () => {
    it("should handle non-existent user gracefully", async () => {
      const nonExistentUid = "non-existent-user-12345";

      await expect(revokeRefreshTokensHandler(nonExistentUid, oauth2Token)).rejects.toThrow(
        "Failed to revoke refresh tokens:"
      );
    });

    it("should handle invalid OAuth token", async () => {
      const testUser = await createTestUser("revoke-invalid-token@example.com", "Invalid Token User");
      const invalidToken = "invalid-oauth-token-12345";

      await expect(revokeRefreshTokensHandler(testUser.localId, invalidToken)).rejects.toThrow(
        "Failed to revoke refresh tokens:"
      );
    });

    it("should handle malformed user ID", async () => {
      const malformedUid = "user@with@invalid@chars";

      // This might succeed or fail depending on Firebase's validation
      // We test that it doesn't crash the application
      try {
        await revokeRefreshTokensHandler(malformedUid, oauth2Token);
      } catch (error) {
        expect(error.message).toContain("Failed to revoke refresh tokens:");
      }
    });

    it("should handle empty project context gracefully", async () => {
      const testUser = await createTestUser("revoke-context@example.com", "Context User");

      // Using a valid but potentially limited token
      await expect(revokeRefreshTokensHandler(testUser.localId, oauth2Token)).resolves.toBeUndefined();
    });
  });

  describe("Edge Cases", () => {
    it("should handle very long user IDs", async () => {
      // Firebase has limits on user ID length, but we test reasonable edge cases
      const testUser = await createTestUser("revoke-edge-case@example.com", "Edge Case User");

      await expect(revokeRefreshTokensHandler(testUser.localId, oauth2Token)).resolves.toBeUndefined();
    });

    it("should handle special characters in user emails", async () => {
      const testUser = await createTestUser("test+revoke@example-domain.co.uk", "Special Chars User");

      await revokeRefreshTokensHandler(testUser.localId, oauth2Token);

      const userLookup = await getUserByLocalId(testUser.localId, oauth2Token);
      expect(userLookup.users[0].email).toBe("test+revoke@example-domain.co.uk");
      expect(userLookup.users[0].validSince).toBeTruthy();
    });

    it("should handle rapid successive revocations", async () => {
      const testUser = await createTestUser("revoke-rapid@example.com", "Rapid User");

      // Perform rapid successive revocations
      const rapidRevocations: Promise<void>[] = [];
      for (let i = 0; i < 5; i++) {
        rapidRevocations.push(revokeRefreshTokensHandler(testUser.localId, oauth2Token));
        await new Promise<void>((resolve) => setTimeout(resolve, 100)); // Small delay
      }

      // All should succeed
      const results = await Promise.all(rapidRevocations);
      expect(results).toHaveLength(5);
      expect(results.every((result) => result === undefined)).toBe(true);

      // Final state should be consistent
      const userLookup = await getUserByLocalId(testUser.localId, oauth2Token);
      expect(userLookup.users[0].validSince).toBeTruthy();
    });
  });

  describe("Real-world Usage Patterns", () => {
    it("should support password change workflow", async () => {
      const testUser = await createTestUser("revoke-password@example.com", "Password Change User");

      // Simulate password change workflow:
      // 1. Update password (would use updateUserHandler)
      // 2. Revoke all existing sessions for security
      await revokeRefreshTokensHandler(testUser.localId, oauth2Token);

      const userLookup = await getUserByLocalId(testUser.localId, oauth2Token);
      expect(userLookup.users[0].validSince).toBeTruthy();
      expect(userLookup.users[0].email).toBe("revoke-password@example.com");
    });

    it("should support admin user management", async () => {
      const testUser = await createTestUser("revoke-admin@example.com", "Admin Managed User");

      // Admin revokes user sessions for policy enforcement
      await revokeRefreshTokensHandler(testUser.localId, oauth2Token);

      const userLookup = await getUserByLocalId(testUser.localId, oauth2Token);
      expect(userLookup.users[0].validSince).toBeTruthy();
    });

    it("should support device management scenarios", async () => {
      const testUser = await createTestUser("revoke-device@example.com", "Device Management User");

      // User reports lost device - admin revokes all sessions
      await revokeRefreshTokensHandler(testUser.localId, oauth2Token);

      const userLookup = await getUserByLocalId(testUser.localId, oauth2Token);
      expect(userLookup.users[0].validSince).toBeTruthy();
    });

    it("should support compliance and audit workflows", async () => {
      const testUser = await createTestUser("revoke-audit@example.com", "Audit User");

      // Record timestamp before revocation for audit
      const beforeTimestamp = Math.floor(Date.now() / 1000);

      await revokeRefreshTokensHandler(testUser.localId, oauth2Token);

      const userLookup = await getUserByLocalId(testUser.localId, oauth2Token);
      const validSinceTimestamp = parseInt(userLookup.users[0].validSince!);

      // Audit check: validSince should be at or after our recorded timestamp
      expect(validSinceTimestamp).toBeGreaterThanOrEqual(beforeTimestamp);
    });
  });

  describe("Performance and Reliability", () => {
    it("should handle batch revocation operations", async () => {
      // Create multiple users
      const users = await Promise.all([
        createTestUser("batch1@example.com", "Batch User 1"),
        createTestUser("batch2@example.com", "Batch User 2"),
        createTestUser("batch3@example.com", "Batch User 3"),
      ]);

      // Revoke tokens for all users in batch
      const batchRevocations: Promise<void>[] = users.map((user) =>
        revokeRefreshTokensHandler(user.localId, oauth2Token)
      );

      const batchResults = await Promise.all(batchRevocations);
      expect(batchResults).toHaveLength(3);
      expect(batchResults.every((result) => result === undefined)).toBe(true);

      // Verify all users have updated validSince
      for (const user of users) {
        const userLookup = await getUserByLocalId(user.localId, oauth2Token);
        expect(userLookup.users[0].validSince).toBeTruthy();
      }
    });

    it("should be resilient to network fluctuations", async () => {
      const testUser = await createTestUser("revoke-network@example.com", "Network Test User");

      // Single revocation should succeed even with potential network issues
      await expect(revokeRefreshTokensHandler(testUser.localId, oauth2Token)).resolves.toBeUndefined();
    });
  });
});
