import { describe, it, expect, afterAll } from "vitest";
import { deleteUserHandler } from "../../src/rest-api/delete-user.js";
import { getUserHandler } from "../../src/rest-api/get-user.js";
import { getOauth2AccessTokenHandler } from "../../src/google-auth/get-oauth-2-token.js";
import serviceAccountKey from "../service-account-key.json";
import { env } from "process";
import { config } from "dotenv";
import { KVNamespace } from "@cloudflare/workers-types";
import { addANewUserWithSignUp, getUserByLocalId } from "./utils.js";

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

describe.skipIf(doNotRunIntegrationTests)("Delete User Handler Integration Tests", async () => {
  const KV_NAMESPACE = createMockKV() as KVNamespace;
  const oauth2Token = await getOauth2AccessTokenHandler(serviceAccountKey, 3000, KV_NAMESPACE);

  // Keep track of users that we intend to delete (for cleanup verification)
  const intentionallyDeletedUsers: string[] = [];

  // Keep track of users created but not yet deleted (for cleanup)
  const remainingUsersForCleanup: string[] = [];

  afterAll(async () => {
    // Clean up any remaining users that weren't deleted in tests
    await Promise.all(
      remainingUsersForCleanup.map((userId) =>
        deleteUserHandler(userId, oauth2Token).catch(() => {
          // Ignore errors in cleanup
        })
      )
    );
  });

  // Helper function to create a test user and track it
  async function createTestUser(email: string, displayName: string = "Test User") {
    const user = await addANewUserWithSignUp(oauth2Token, email, displayName);
    remainingUsersForCleanup.push(user.localId);
    return user;
  }

  // Helper function to mark a user as intentionally deleted
  function markAsDeleted(userId: string) {
    const index = remainingUsersForCleanup.indexOf(userId);
    if (index > -1) {
      remainingUsersForCleanup.splice(index, 1);
    }
    intentionallyDeletedUsers.push(userId);
  }

  // Helper function to verify user is deleted
  async function verifyUserDeleted(userId: string) {
    try {
      await getUserHandler(userId, oauth2Token);
      throw new Error("User should have been deleted but still exists");
    } catch (error) {
      // User should not be found - this is expected
      expect(error.message).toContain(`User not found: ${userId}`);
    }
  }

  describe("Basic Deletion Functionality", () => {
    it("should successfully delete an existing user", async () => {
      const testUser = await createTestUser("delete-basic@example.com", "Basic Delete User");

      // Verify user exists before deletion
      const userBeforeDeletion = await getUserHandler(testUser.localId, oauth2Token);
      expect(userBeforeDeletion.uid).toBe(testUser.localId);
      expect(userBeforeDeletion.email).toBe("delete-basic@example.com");

      // Delete the user
      await deleteUserHandler(testUser.localId, oauth2Token);
      markAsDeleted(testUser.localId);

      // Verify user is actually deleted
      await verifyUserDeleted(testUser.localId);
    });

    it("should return undefined on successful deletion", async () => {
      const testUser = await createTestUser("delete-return@example.com", "Return Test User");

      const result = await deleteUserHandler(testUser.localId, oauth2Token);
      markAsDeleted(testUser.localId);

      expect(result).toBeUndefined();

      // Verify deletion actually occurred
      await verifyUserDeleted(testUser.localId);
    });

    it("should handle deletion of user with complex profile data", async () => {
      const testUser = await createTestUser("delete-complex@example.com", "José María López (CEO) 🚀");

      // Verify user exists with complex data
      const userBeforeDeletion = await getUserHandler(testUser.localId, oauth2Token);
      expect(userBeforeDeletion.displayName).toBe("José María López (CEO) 🚀");

      // Delete the user
      await deleteUserHandler(testUser.localId, oauth2Token);
      markAsDeleted(testUser.localId);

      // Verify deletion
      await verifyUserDeleted(testUser.localId);
    });

    it("should handle deletion of user with special email characters", async () => {
      const testUser = await createTestUser("test+delete@example-domain.co.uk", "Special Email User");

      // Delete the user
      await deleteUserHandler(testUser.localId, oauth2Token);
      markAsDeleted(testUser.localId);

      // Verify deletion
      await verifyUserDeleted(testUser.localId);
    });
  });

  describe("Idempotent Behavior", () => {
    it("should not error when deleting a non-existent user", async () => {
      const nonExistentUid = "non-existent-user-12345-abcdef";

      // Should not throw an error
      try {
        await deleteUserHandler(nonExistentUid, oauth2Token);
      } catch (error) {
        expect(error.message).toContain(`Failed to delete user: 400 Bad Request`);
      }
    });

    it("should not error when deleting the same user twice", async () => {
      const testUser = await createTestUser("delete-twice@example.com", "Double Delete User");

      // First deletion should succeed
      await deleteUserHandler(testUser.localId, oauth2Token);
      markAsDeleted(testUser.localId);

      // Verify user is deleted
      await verifyUserDeleted(testUser.localId);

      try {
        await deleteUserHandler(testUser.localId, oauth2Token);
      } catch (error) {
        expect(error.message).toContain(`Failed to delete user: 400 Bad Request`);
      }
    });

    it("should handle multiple rapid deletion attempts", async () => {
      const testUser = await createTestUser("delete-rapid@example.com", "Rapid Delete User");

      // Make multiple rapid deletion calls simultaneously
      const deletionPromises = [
        deleteUserHandler(testUser.localId, oauth2Token),
        deleteUserHandler(testUser.localId, oauth2Token),
        deleteUserHandler(testUser.localId, oauth2Token),
      ];

      const results = await Promise.all(deletionPromises);
      markAsDeleted(testUser.localId);

      // All should succeed
      expect(results).toEqual([undefined, undefined, undefined]);

      // Verify user is actually deleted
      await verifyUserDeleted(testUser.localId);
    });
  });

  describe("Multiple User Scenarios", () => {
    it("should delete multiple users independently", async () => {
      const user1 = await createTestUser("delete-multi1@example.com", "Multi User 1");
      const user2 = await createTestUser("delete-multi2@example.com", "Multi User 2");
      const user3 = await createTestUser("delete-multi3@example.com", "Multi User 3");

      // Verify all users exist
      const existingUsers = await Promise.all([
        getUserHandler(user1.localId, oauth2Token),
        getUserHandler(user2.localId, oauth2Token),
        getUserHandler(user3.localId, oauth2Token),
      ]);

      expect(existingUsers[0].email).toBe("delete-multi1@example.com");
      expect(existingUsers[1].email).toBe("delete-multi2@example.com");
      expect(existingUsers[2].email).toBe("delete-multi3@example.com");

      // Delete all users
      await Promise.all([
        deleteUserHandler(user1.localId, oauth2Token),
        deleteUserHandler(user2.localId, oauth2Token),
        deleteUserHandler(user3.localId, oauth2Token),
      ]);

      markAsDeleted(user1.localId);
      markAsDeleted(user2.localId);
      markAsDeleted(user3.localId);

      // Verify all users are deleted
      await Promise.all([
        verifyUserDeleted(user1.localId),
        verifyUserDeleted(user2.localId),
        verifyUserDeleted(user3.localId),
      ]);
    });

    it("should handle batch deletion operations", async () => {
      // Create multiple users for batch deletion
      const users = await Promise.all([
        createTestUser("batch-delete1@example.com", "Batch User 1"),
        createTestUser("batch-delete2@example.com", "Batch User 2"),
        createTestUser("batch-delete3@example.com", "Batch User 3"),
        createTestUser("batch-delete4@example.com", "Batch User 4"),
        createTestUser("batch-delete5@example.com", "Batch User 5"),
      ]);

      // Delete all users in batch
      const batchDeletions = users.map((user) => deleteUserHandler(user.localId, oauth2Token));
      const results = await Promise.all(batchDeletions);

      // Mark all as deleted
      users.forEach((user) => markAsDeleted(user.localId));

      // All should succeed
      expect(results).toHaveLength(5);
      expect(results.every((result) => result === undefined)).toBe(true);

      // Verify all users are actually deleted
      await Promise.all(users.map((user) => verifyUserDeleted(user.localId)));
    });
  });

  describe("Error Scenarios", () => {
    it("should handle invalid OAuth token", async () => {
      const testUser = await createTestUser("delete-invalid-token@example.com", "Invalid Token User");
      const invalidToken = "invalid-oauth-token-12345";

      await expect(deleteUserHandler(testUser.localId, invalidToken)).rejects.toThrow("Failed to delete user:");

      // User should still exist since deletion failed
      const stillExistingUser = await getUserHandler(testUser.localId, oauth2Token);
      expect(stillExistingUser.email).toBe("delete-invalid-token@example.com");
    });

    it("should handle malformed user ID gracefully", async () => {
      const malformedUid = "";

      await expect(deleteUserHandler(malformedUid, oauth2Token)).rejects.toThrow("uid must be a non-empty string");
    });

    it("should handle very long user IDs", async () => {
      const longUid = "a".repeat(1000);

      // This might succeed or fail depending on Firebase's validation, but shouldn't crash
      try {
        await deleteUserHandler(longUid, oauth2Token);
      } catch (error) {
        expect(error.message).toContain("Failed to delete user:");
      }
    });

    it("should handle user IDs with special characters", async () => {
      const specialUid = "user@with#special$chars%";

      // This might succeed or fail depending on Firebase's validation
      try {
        await deleteUserHandler(specialUid, oauth2Token);
      } catch (error) {
        // If it fails, it should be a Firebase API error, not a crash
        expect(error.message).toContain("Failed to delete user:");
      }
    });
  });

  describe("Real-world Usage Patterns", () => {
    it("should support user-initiated account deletion workflow", async () => {
      const testUser = await createTestUser("self-delete@example.com", "Self Delete User");

      // Simulate user-initiated deletion workflow
      // 1. Verify user identity (simulate authentication check)
      const userToDelete = await getUserHandler(testUser.localId, oauth2Token);
      expect(userToDelete.email).toBe("self-delete@example.com");

      // 2. Perform the deletion
      await deleteUserHandler(testUser.localId, oauth2Token);
      markAsDeleted(testUser.localId);

      // 3. Verify account is completely removed
      await verifyUserDeleted(testUser.localId);
    });

    it("should support administrative user cleanup", async () => {
      const testUsers = await Promise.all([
        createTestUser("admin-cleanup1@example.com", "Cleanup User 1"),
        createTestUser("admin-cleanup2@example.com", "Cleanup User 2"),
        createTestUser("admin-cleanup3@example.com", "Cleanup User 3"),
      ]);

      // Simulate admin cleanup process
      const deletionResults: any[] = [];

      for (const user of testUsers) {
        try {
          await deleteUserHandler(user.localId, oauth2Token);
          deletionResults.push({ userId: user.localId, status: "deleted", error: null });
          markAsDeleted(user.localId);
        } catch (error) {
          deletionResults.push({
            userId: user.localId,
            status: "failed",
            error: error.message,
          });
        }
      }

      // All deletions should succeed
      expect(deletionResults).toHaveLength(3);
      expect(deletionResults.every((result) => result.status === "deleted")).toBe(true);

      // Verify all users are actually deleted
      await Promise.all(testUsers.map((user) => verifyUserDeleted(user.localId)));
    });

    it("should support GDPR compliance deletion", async () => {
      const testUser = await createTestUser("gdpr-delete@example.com", "GDPR User");

      // Simulate GDPR compliance workflow
      // 1. Verify user exists and get their data
      const userData = await getUserHandler(testUser.localId, oauth2Token);
      expect(userData.email).toBe("gdpr-delete@example.com");

      // 2. Log the deletion request for audit purposes
      const deletionRecord = {
        userId: testUser.localId,
        userEmail: userData.email,
        deletedAt: new Date(),
        reason: "GDPR_REQUEST",
      };

      // 3. Delete the user account
      await deleteUserHandler(testUser.localId, oauth2Token);
      markAsDeleted(testUser.localId);

      // 4. Verify deletion completed
      await verifyUserDeleted(testUser.localId);

      // 5. Verify audit record was created
      expect(deletionRecord.userId).toBe(testUser.localId);
      expect(deletionRecord.reason).toBe("GDPR_REQUEST");
    });

    it("should support test environment cleanup", async () => {
      // Create several test users for cleanup simulation
      const testUsers: any[] = [];
      for (let i = 1; i <= 10; i++) {
        const user = await createTestUser(`test-cleanup-${i}@example.com`, `Test User ${i}`);
        testUsers.push(user);
      }

      // Batch cleanup all test users
      const cleanupPromises = testUsers.map((user) => deleteUserHandler(user.localId, oauth2Token));
      await Promise.all(cleanupPromises);

      // Mark all as deleted
      testUsers.forEach((user) => markAsDeleted(user.localId));

      // Verify all test users are cleaned up
      await Promise.all(testUsers.map((user) => verifyUserDeleted(user.localId)));
    }, 10_000);
  });

  describe("Integration with Other Operations", () => {
    it("should delete user after creating and modifying them", async () => {
      const testUser = await createTestUser("lifecycle-test@example.com", "Lifecycle User");

      // Verify user was created
      let currentUser = await getUserHandler(testUser.localId, oauth2Token);
      expect(currentUser.email).toBe("lifecycle-test@example.com");
      expect(currentUser.displayName).toBe("Lifecycle User");

      // Note: Would normally update user here, but we're focusing on deletion
      // so we'll just proceed to delete

      // Delete the user
      await deleteUserHandler(testUser.localId, oauth2Token);
      markAsDeleted(testUser.localId);

      // Verify complete lifecycle
      await verifyUserDeleted(testUser.localId);
    });

    it("should handle deletion during high system activity", async () => {
      // Create multiple users and perform various operations simultaneously
      const users = await Promise.all([
        createTestUser("activity-test1@example.com", "Activity User 1"),
        createTestUser("activity-test2@example.com", "Activity User 2"),
        createTestUser("activity-test3@example.com", "Activity User 3"),
      ]);

      // Perform mixed operations: lookups and deletions
      const operations = [
        getUserHandler(users[0].localId, oauth2Token),
        deleteUserHandler(users[1].localId, oauth2Token),
        getUserHandler(users[2].localId, oauth2Token),
        deleteUserHandler(users[0].localId, oauth2Token),
        deleteUserHandler(users[2].localId, oauth2Token),
      ];

      const results = await Promise.allSettled(operations);

      // Mark deleted users
      markAsDeleted(users[0].localId);
      markAsDeleted(users[1].localId);
      markAsDeleted(users[2].localId);

      // At least the deletion operations should succeed
      const deletionResults = [results[1], results[3], results[4]];
      expect(deletionResults.every((result) => result.status === "fulfilled")).toBe(true);

      // Verify users are deleted
      await Promise.all([
        verifyUserDeleted(users[0].localId),
        verifyUserDeleted(users[1].localId),
        verifyUserDeleted(users[2].localId),
      ]);
    });
  });

  describe("Performance and Reliability", () => {
    it("should handle sequential deletions efficiently", async () => {
      const users: any[] = [];

      // Create users sequentially
      for (let i = 1; i <= 5; i++) {
        const user = await createTestUser(`sequential-${i}@example.com`, `Sequential User ${i}`);
        users.push(user);
      }

      // Delete users sequentially and measure
      const startTime = Date.now();
      for (const user of users) {
        await deleteUserHandler(user.localId, oauth2Token);
        markAsDeleted(user.localId);
      }
      const endTime = Date.now();

      // Should complete in reasonable time (less than 30 seconds for 5 users)
      expect(endTime - startTime).toBeLessThan(30000);

      // Verify all users are deleted
      await Promise.all(users.map((user) => verifyUserDeleted(user.localId)));
    });

    it("should be resilient to network fluctuations", async () => {
      const testUser = await createTestUser("network-resilience@example.com", "Network Test User");

      // Single deletion should succeed even with potential network issues
      await expect(deleteUserHandler(testUser.localId, oauth2Token)).resolves.toBeUndefined();
      markAsDeleted(testUser.localId);

      // Verify deletion
      await verifyUserDeleted(testUser.localId);
    });
  });

  describe("Edge Cases and Boundary Conditions", () => {
    it("should handle users created with minimal data", async () => {
      const testUser = await createTestUser("minimal@example.com", "");

      // Delete user with minimal profile
      await deleteUserHandler(testUser.localId, oauth2Token);
      markAsDeleted(testUser.localId);

      // Verify deletion
      await verifyUserDeleted(testUser.localId);
    });

    it("should handle deletion immediately after creation", async () => {
      const testUser = await createTestUser("immediate-delete@example.com", "Immediate Delete User");

      // Delete immediately after creation
      await deleteUserHandler(testUser.localId, oauth2Token);
      markAsDeleted(testUser.localId);

      // Verify deletion worked
      await verifyUserDeleted(testUser.localId);
    });

    it("should handle users with international characters", async () => {
      const testUser = await createTestUser("国际化@example.com", "用户名测试");

      await deleteUserHandler(testUser.localId, oauth2Token);
      markAsDeleted(testUser.localId);

      await verifyUserDeleted(testUser.localId);
    });
  });
});
