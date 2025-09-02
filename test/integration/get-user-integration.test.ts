import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getUserHandler } from "../../src/rest-api/get-user.js";
import { getOauth2AccessTokenHandler } from "../../src/google-auth/get-oauth-2-token.js";
import { addANewUserWithSignUp, deleteUser } from "./utils.js";
import { setCustomUserClaimsHandler } from "../../src/rest-api/set-custom-user-claims.js";
import fs from "fs";

describe("getUserHandler Integration Tests", () => {
  let oauth2Token: string;
  let testUserId: string;
  const baseUserEmail = "test-get-user@example.com";

  beforeAll(async () => {
    const serviceAccountKey = JSON.parse(fs.readFileSync("test/service-account-key.json", "utf-8"));
    oauth2Token = await getOauth2AccessTokenHandler(serviceAccountKey, 3000);

    // Create a test user with comprehensive data
    const testUser = await addANewUserWithSignUp(oauth2Token, baseUserEmail, "Get User Test");
    testUserId = testUser.localId;

    // Set custom claims for testing
    await setCustomUserClaimsHandler(
      testUserId,
      {
        role: "test-user",
        department: "qa",
        permissions: ["read", "write"],
        subscription: {
          tier: "premium",
          expires: "2024-12-31",
        },
      },
      oauth2Token
    );

    // Wait for changes to propagate
    await new Promise((resolve) => setTimeout(resolve, 500));
  });

  afterAll(async () => {
    if (testUserId) {
      await deleteUser(testUserId, oauth2Token);
    }
  });

  describe("Successful User Retrieval", () => {
    it("should retrieve complete user information", async () => {
      const user = await getUserHandler(testUserId, oauth2Token);

      expect(user).toMatchObject({
        uid: testUserId,
        email: baseUserEmail,
        emailVerified: false, // New users are not verified by default
        displayName: "Get User Test",
        disabled: false,
      });

      // Check metadata exists and has expected structure
      expect(user.metadata).toBeDefined();
      expect(user.metadata.creationTime).toBeTruthy();
      expect(typeof user.metadata.creationTime).toBe("string");

      // Custom claims should be present
      expect(user.customClaims).toMatchObject({
        role: "test-user",
        department: "qa",
        permissions: ["read", "write"],
        subscription: {
          tier: "premium",
          expires: "2024-12-31",
        },
      });
    });

    it("should handle user with no custom claims", async () => {
      // Create another user without custom claims
      const userWithoutClaims = await addANewUserWithSignUp(oauth2Token, "no-claims@example.com", "No Claims User");
      const userWithoutClaimsId = userWithoutClaims.localId;

      try {
        const user = await getUserHandler(userWithoutClaimsId, oauth2Token);

        expect(user).toMatchObject({
          uid: userWithoutClaimsId,
          email: "no-claims@example.com",
          displayName: "No Claims User",
          customClaims: null, // Should be null when no custom claims
        });
      } finally {
        await deleteUser(userWithoutClaimsId, oauth2Token);
      }
    });

    it("should retrieve user with minimal profile data", async () => {
      // Create user with minimal data (no displayName)
      const minimalUser = await addANewUserWithSignUp(oauth2Token, "minimal@example.com", "");
      const minimalUserId = minimalUser.localId;

      try {
        const user = await getUserHandler(minimalUserId, oauth2Token);

        expect(user).toMatchObject({
          uid: minimalUserId,
          email: "minimal@example.com",
          emailVerified: false,
          displayName: null, // Should be null when not provided
          photoURL: null,
          phoneNumber: null,
          disabled: false,
          customClaims: null,
        });

        expect(user.metadata).toBeDefined();
      } finally {
        await deleteUser(minimalUserId, oauth2Token);
      }
    });
  });

  describe("Provider Data", () => {
    it("should include password provider in providerData", async () => {
      const user = await getUserHandler(testUserId, oauth2Token);

      console.log("user", user);

      // All users created with email/password should have password provider
      const passwordProvider = user.providerData.find((p) => p.providerId === "password");
      expect(passwordProvider).toBeDefined();
      expect(passwordProvider?.uid).toBe(baseUserEmail);
      expect(passwordProvider?.email).toBe(baseUserEmail);
    });
  });

  describe("Custom Claims Scenarios", () => {
    it("should handle complex custom claims structure", async () => {
      const complexUser = await addANewUserWithSignUp(oauth2Token, "complex-claims@example.com", "Complex Claims User");
      const complexUserId = complexUser.localId;

      try {
        // Set complex custom claims
        await setCustomUserClaimsHandler(
          complexUserId,
          {
            role: "admin",
            organizations: [
              { id: "org1", name: "Organization 1", permissions: ["read", "write", "admin"] },
              { id: "org2", name: "Organization 2", permissions: ["read"] },
            ],
            features: {
              betaTesting: true,
              analytics: false,
              apiAccess: true,
            },
            metadata: {
              lastUpdated: new Date().toISOString(),
              version: "2.0",
            },
          },
          oauth2Token
        );

        // Wait for propagation
        await new Promise((resolve) => setTimeout(resolve, 500));

        const user = await getUserHandler(complexUserId, oauth2Token);

        expect(user.customClaims).toMatchObject({
          role: "admin",
          organizations: expect.arrayContaining([
            expect.objectContaining({
              id: "org1",
              name: "Organization 1",
              permissions: expect.arrayContaining(["read", "write", "admin"]),
            }),
          ]),
          features: {
            betaTesting: true,
            analytics: false,
            apiAccess: true,
          },
          metadata: expect.objectContaining({
            version: "2.0",
          }),
        });
      } finally {
        await deleteUser(complexUserId, oauth2Token);
      }
    });

    it("should handle claims being cleared", async () => {
      const claimsUser = await addANewUserWithSignUp(oauth2Token, "claims-clear@example.com", "Claims Clear User");
      const claimsUserId = claimsUser.localId;

      try {
        // First set some claims
        await setCustomUserClaimsHandler(claimsUserId, { role: "user", temp: true }, oauth2Token);

        // Then clear them
        await setCustomUserClaimsHandler(claimsUserId, null, oauth2Token);

        // Wait for propagation
        await new Promise((resolve) => setTimeout(resolve, 500));

        const user = await getUserHandler(claimsUserId, oauth2Token);

        expect(user.customClaims).toEqual({});
      } finally {
        await deleteUser(claimsUserId, oauth2Token);
      }
    });
  });

  describe("Error Scenarios", () => {
    it("should throw error for non-existent user", async () => {
      const nonExistentUid = "non-existent-user-id-12345";

      await expect(getUserHandler(nonExistentUid, oauth2Token)).rejects.toThrow(`User not found: ${nonExistentUid}`);
    });

    it("should throw error with invalid OAuth token", async () => {
      const invalidToken = "invalid-oauth-token-12345";

      await expect(getUserHandler(testUserId, invalidToken)).rejects.toThrow("Failed to get user:");
    });

    it("should throw error with malformed UID", async () => {
      const malformedUid = ""; // Empty UID

      await expect(getUserHandler(malformedUid, oauth2Token)).rejects.toThrow();
    });

    it("should handle expired OAuth token", async () => {
      const expiredToken = "ya29.expired-token-example";

      await expect(getUserHandler(testUserId, expiredToken)).rejects.toThrow("Failed to get user:");
    });
  });

  describe("Real-world Scenarios", () => {
    it("should retrieve user after profile updates", async () => {
      const updatedUser = await addANewUserWithSignUp(oauth2Token, "updated-user@example.com", "Original Name");
      const updatedUserId = updatedUser.localId;

      try {
        // Update user claims and verify they're reflected
        await setCustomUserClaimsHandler(
          updatedUserId,
          {
            userProfile: {
              preferences: { theme: "dark", language: "en" },
              tags: ["early-adopter", "power-user"],
            },
          },
          oauth2Token
        );

        // Wait for propagation
        await new Promise((resolve) => setTimeout(resolve, 500));

        const user = await getUserHandler(updatedUserId, oauth2Token);

        expect(user.customClaims).toMatchObject({
          userProfile: {
            preferences: { theme: "dark", language: "en" },
            tags: ["early-adopter", "power-user"],
          },
        });

        expect(user.email).toBe("updated-user@example.com");
        expect(user.displayName).toBe("Original Name");
      } finally {
        await deleteUser(updatedUserId, oauth2Token);
      }
    });

    it("should handle users with special characters in email", async () => {
      const specialEmail = "test.user+tag@example-domain.com";
      const specialUser = await addANewUserWithSignUp(oauth2Token, specialEmail, "Special Email User");
      const specialUserId = specialUser.localId;

      try {
        const user = await getUserHandler(specialUserId, oauth2Token);

        expect(user.email).toBe(specialEmail);
        expect(user.displayName).toBe("Special Email User");
        expect(user.uid).toBe(specialUserId);
      } finally {
        await deleteUser(specialUserId, oauth2Token);
      }
    });

    it("should retrieve user multiple times consistently", async () => {
      // Get the same user multiple times to ensure consistency
      const user1 = await getUserHandler(testUserId, oauth2Token);
      const user2 = await getUserHandler(testUserId, oauth2Token);
      const user3 = await getUserHandler(testUserId, oauth2Token);

      expect(user1).toEqual(user2);
      expect(user2).toEqual(user3);

      // All should have the same UID and email
      expect(user1.uid).toBe(user2.uid);
      expect(user2.uid).toBe(user3.uid);
      expect(user1.email).toBe(user2.email);
      expect(user2.email).toBe(user3.email);
    });
  });

  describe("Performance and Edge Cases", () => {
    it("should handle concurrent requests for the same user", async () => {
      const concurrentRequests = Array.from({ length: 5 }, () => getUserHandler(testUserId, oauth2Token));

      const results = await Promise.all(concurrentRequests);

      // All results should be identical
      results.forEach((user, index) => {
        expect(user.uid).toBe(testUserId);
        expect(user.email).toBe(baseUserEmail);
        if (index > 0) {
          expect(user).toEqual(results[0]);
        }
      });
    });

    it("should handle requests for different users concurrently", async () => {
      // Create multiple test users
      const users = await Promise.all([
        addANewUserWithSignUp(oauth2Token, "concurrent1@example.com", "Concurrent User 1"),
        addANewUserWithSignUp(oauth2Token, "concurrent2@example.com", "Concurrent User 2"),
        addANewUserWithSignUp(oauth2Token, "concurrent3@example.com", "Concurrent User 3"),
      ]);

      try {
        // Request all users concurrently
        const userResults = await Promise.all(users.map((user) => getUserHandler(user.localId, oauth2Token)));

        // Verify each user has the correct data
        userResults.forEach((user, index) => {
          expect(user.uid).toBe(users[index].localId);
          expect(user.email).toBe(
            ["concurrent1@example.com", "concurrent2@example.com", "concurrent3@example.com"][index]
          );
          expect(user.displayName).toBe(`Concurrent User ${index + 1}`);
        });
      } finally {
        // Cleanup
        await Promise.all(users.map((user) => deleteUser(user.localId, oauth2Token)));
      }
    });
  });
});
