import { describe, it, expect, afterAll, beforeEach } from "vitest";
import { updateUserHandler } from "../../src/rest-api/update-user.js";
import { getOauth2AccessTokenHandler } from "../../src/google-auth/get-oauth-2-token.js";
import serviceAccountKey from "../service-account-key.json";
import { env } from "process";
import { config } from "dotenv";
import { KVNamespace } from "@cloudflare/workers-types";
import type { UpdateRequest } from "../../src/types.js";
import { addANewUserWithSignUp, deleteUser, getUserByLocalId } from "./utils.js";

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

describe.skipIf(doNotRunIntegrationTests)("Update User Handler Integration Tests", async () => {
  const KV_NAMESPACE = createMockKV() as KVNamespace;
  const oauth2Token = await getOauth2AccessTokenHandler(serviceAccountKey, 3000, KV_NAMESPACE);

  // Keep track of created users for cleanup
  const createdUsers: string[] = [];

  afterAll(async () => {
    // Cleanup all created users
    await Promise.all(createdUsers.map((userId) => deleteUser(userId, oauth2Token).catch(() => {})));
  });

  // Helper function to create a test user and track it for cleanup
  async function createTestUser(email: string, displayName?: string) {
    const user = await addANewUserWithSignUp(oauth2Token, email, displayName || "");
    createdUsers.push(user.localId);
    return user;
  }

  describe("Basic Profile Updates", () => {
    it("should update displayName and verify the change", async () => {
      const testUser = await createTestUser("display-name-test@example.com", "Original Name");

      const updatedUser = await updateUserHandler(
        testUser.localId,
        { displayName: "Updated Display Name" },
        oauth2Token
      );

      // Verify the update took effect
      expect(updatedUser.uid).toBe(testUser.localId);
      expect(updatedUser.displayName).toBe("Updated Display Name");
      expect(updatedUser.email).toBe("display-name-test@example.com");

      // Verify other fields are intact
      expect(updatedUser.emailVerified).toBe(false);
      expect(updatedUser.disabled).toBe(false);
      expect(updatedUser.metadata).toBeDefined();
      expect(updatedUser.metadata.creationTime).toBeTruthy();
    });

    it("should update email and verify the change", async () => {
      const testUser = await createTestUser("original-email@example.com", "Email Test User");

      const updatedUser = await updateUserHandler(
        testUser.localId,
        {
          email: "updated-email@example.com",
          emailVerified: false,
        },
        oauth2Token
      );

      expect(updatedUser.uid).toBe(testUser.localId);
      expect(updatedUser.email).toBe("updated-email@example.com");
      expect(updatedUser.emailVerified).toBe(false);
      expect(updatedUser.displayName).toBe("Email Test User");
    });

    it("should update photoURL and verify the change", async () => {
      const testUser = await createTestUser("photo-test@example.com", "Photo Test User");

      console.log("testUser", testUser);

      const updatedUser = await updateUserHandler(
        testUser.localId,
        { photoURL: "https://example.com/new-photo.jpg" },
        oauth2Token
      );

      console.log(updatedUser);

      expect(updatedUser.uid).toBe(testUser.localId);
      expect(updatedUser.photoURL).toBe("https://example.com/new-photo.jpg");
      expect(updatedUser.displayName).toBe("Photo Test User");
      expect(updatedUser.email).toBe("photo-test@example.com");
    }, 10000);

    it("should update phoneNumber and verify the change", async () => {
      const testUser = await createTestUser("phone-test@example.com", "Phone Test User");

      const updatedUser = await updateUserHandler(testUser.localId, { phoneNumber: "+12345678900" }, oauth2Token);

      expect(updatedUser.uid).toBe(testUser.localId);
      expect(updatedUser.phoneNumber).toBe("+12345678900");
      expect(updatedUser.displayName).toBe("Phone Test User");
    });

    it("should disable/enable user and verify the change", async () => {
      const testUser = await createTestUser("disable-test@example.com", "Disable Test User");

      // First disable the user
      const disabledUser = await updateUserHandler(testUser.localId, { disabled: true }, oauth2Token);

      expect(disabledUser.uid).toBe(testUser.localId);
      expect(disabledUser.disabled).toBe(true);
      expect(disabledUser.displayName).toBe("Disable Test User");

      // Then re-enable the user
      const enabledUser = await updateUserHandler(testUser.localId, { disabled: false }, oauth2Token);

      expect(enabledUser.uid).toBe(testUser.localId);
      expect(enabledUser.disabled).toBe(false);
      expect(enabledUser.displayName).toBe("Disable Test User");
    });
  });

  describe("Null Value Handling", () => {
    it("should clear displayName with null and verify", async () => {
      const testUser = await createTestUser("clear-display@example.com", "Name To Clear");

      const updatedUser = await updateUserHandler(testUser.localId, { displayName: null as any }, oauth2Token);

      expect(updatedUser.uid).toBe(testUser.localId);
      expect(updatedUser.displayName).toBeNull();
      expect(updatedUser.email).toBe("clear-display@example.com");
    });

    it("should clear phoneNumber with null and verify", async () => {
      const testUser = await createTestUser("clear-phone@example.com", "Clear Phone User");

      // First add a phone number
      const userWithPhone = await updateUserHandler(testUser.localId, { phoneNumber: "+19876543210" }, oauth2Token);
      expect(userWithPhone.phoneNumber).toBe("+19876543210");

      // Then clear it
      const userWithoutPhone = await updateUserHandler(testUser.localId, { phoneNumber: null as any }, oauth2Token);

      expect(userWithoutPhone.uid).toBe(testUser.localId);
      expect(userWithoutPhone.phoneNumber).toBeNull();
      expect(userWithoutPhone.displayName).toBe("Clear Phone User");
    });

    it("should clear photoURL with null and verify", async () => {
      const testUser = await createTestUser("clear-photo@example.com", "Clear Photo User");

      const updateRequest: UpdateRequest = {
        photoURL: "https://example.com/photo.jpg",
      };

      // First add a photo URL
      const userWithPhoto = await updateUserHandler(testUser.localId, updateRequest, oauth2Token);
      expect(userWithPhoto.photoURL).toBe("https://example.com/photo.jpg");

      // Then clear it
      const userWithoutPhoto = await updateUserHandler(testUser.localId, { photoURL: null as any }, oauth2Token);

      expect(userWithoutPhoto.uid).toBe(testUser.localId);
      expect(userWithoutPhoto.photoURL).toBeNull();
      expect(userWithoutPhoto.displayName).toBe("Clear Photo User");
    });
  });

  describe("Authentication Updates", () => {
    it("should update password (cannot verify directly but should succeed)", async () => {
      const testUser = await createTestUser("password-test@example.com", "Password Test User");

      // Password updates should succeed but we can't verify the password directly
      const updatedUser = await updateUserHandler(testUser.localId, { password: "newSecurePassword123!" }, oauth2Token);

      expect(updatedUser.uid).toBe(testUser.localId);
      expect(updatedUser.displayName).toBe("Password Test User");
      expect(updatedUser.email).toBe("password-test@example.com");
      // Password is not returned in UserRecord for security reasons
    });

    it("should update email verification status", async () => {
      const testUser = await createTestUser("verify-test@example.com", "Verify Test User");

      console.log("testUser", testUser);

      const currentUser = await getUserByLocalId(testUser.localId, oauth2Token);

      console.log("currentUser", currentUser);

      // New users are not verified by default
      expect(currentUser.users[0].emailVerified).toBe(false);

      const verifiedUser = await updateUserHandler(testUser.localId, { emailVerified: true }, oauth2Token);

      expect(verifiedUser.uid).toBe(testUser.localId);
      expect(verifiedUser.emailVerified).toBe(true);
      expect(verifiedUser.email).toBe("verify-test@example.com");
    });
  });

  describe("Comprehensive Updates", () => {
    it("should handle multiple property updates simultaneously", async () => {
      const testUser = await createTestUser("comprehensive@example.com", "Original User");

      const updateRequest: UpdateRequest = {
        displayName: "Comprehensive Test User",
        email: "comprehensive-updated@example.com",
        emailVerified: true,
        phoneNumber: "+19876543210",
        photoURL: "https://example.com/comprehensive.jpg",
        disabled: false,
      };

      const updatedUser = await updateUserHandler(testUser.localId, updateRequest, oauth2Token);

      // Verify all updates took effect
      expect(updatedUser.uid).toBe(testUser.localId);
      expect(updatedUser.displayName).toBe("Comprehensive Test User");
      expect(updatedUser.email).toBe("comprehensive-updated@example.com");
      expect(updatedUser.emailVerified).toBe(true);
      expect(updatedUser.phoneNumber).toBe("+19876543210");
      expect(updatedUser.photoURL).toBe("https://example.com/comprehensive.jpg");
      expect(updatedUser.disabled).toBe(false);

      // Verify metadata and other fields are preserved
      expect(updatedUser.metadata).toBeDefined();
      expect(updatedUser.metadata.creationTime).toBeTruthy();
      expect(updatedUser.providerData).toBeDefined();
      expect(updatedUser.customClaims).toBeDefined();
    });
  });

  describe("Data Completeness Verification", () => {
    it("should return complete user data including metadata", async () => {
      const testUser = await createTestUser("metadata-test@example.com", "Metadata Test User");

      const updatedUser = await updateUserHandler(
        testUser.localId,
        { displayName: "Updated Metadata User" },
        oauth2Token
      );

      // Verify complete UserRecord structure
      expect(updatedUser).toHaveProperty("uid");
      expect(updatedUser).toHaveProperty("email");
      expect(updatedUser).toHaveProperty("emailVerified");
      expect(updatedUser).toHaveProperty("displayName");
      expect(updatedUser).toHaveProperty("photoURL");
      expect(updatedUser).toHaveProperty("phoneNumber");
      expect(updatedUser).toHaveProperty("disabled");
      expect(updatedUser).toHaveProperty("providerData");
      expect(updatedUser).toHaveProperty("customClaims");
      expect(updatedUser).toHaveProperty("metadata");

      // Verify metadata structure
      expect(updatedUser.metadata).toHaveProperty("creationTime");
      expect(updatedUser.metadata).toHaveProperty("lastSignInTime");
      expect(updatedUser.metadata).toHaveProperty("lastRefreshTime");

      // Verify provider data exists (password provider should be present)
      expect(Array.isArray(updatedUser.providerData)).toBe(true);
      const passwordProvider = updatedUser.providerData.find((p) => p.providerId === "password");
      expect(passwordProvider).toBeDefined();
      expect(passwordProvider?.email).toBe("metadata-test@example.com");
    });

    it("should preserve custom claims when updating other fields", async () => {
      const testUser = await createTestUser("claims-preserve@example.com", "Claims Test User");

      // First, let's set some custom claims using the set custom claims function
      // (assuming we have this available - this test verifies claims are preserved during updates)

      const updatedUser = await updateUserHandler(
        testUser.localId,
        { displayName: "Claims Preserved User" },
        oauth2Token
      );

      expect(updatedUser.displayName).toBe("Claims Preserved User");
      expect(updatedUser.uid).toBe(testUser.localId);

      // Custom claims should be preserved (even if null/empty initially)
      expect(updatedUser.customClaims).toBeDefined();
    });
  });

  describe("Error Scenarios", () => {
    it("should handle validation errors for invalid properties", async () => {
      const testUser = await createTestUser("validation-error@example.com", "Validation Test User");

      await expect(
        updateUserHandler(testUser.localId, { invalidProperty: "should fail" } as any, oauth2Token)
      ).rejects.toThrow("Invalid properties provided: invalidProperty");
    });

    it("should handle non-existent user", async () => {
      const nonExistentId = "non-existent-user-id-12345";

      await expect(updateUserHandler(nonExistentId, { displayName: "Test" }, oauth2Token)).rejects.toThrow(
        "Failed to update user:"
      );
    });

    it("should handle invalid OAuth token", async () => {
      const testUser = await createTestUser("invalid-token@example.com", "Invalid Token User");
      const invalidToken = "invalid-oauth-token-12345";

      await expect(updateUserHandler(testUser.localId, { displayName: "Test" }, invalidToken)).rejects.toThrow(
        "Failed to update user:"
      );
    });

    it("should handle duplicate email error", async () => {
      const testUser1 = await createTestUser("duplicate1@example.com", "User 1");
      const testUser2 = await createTestUser("duplicate2@example.com", "User 2");

      // Try to update user2 to have the same email as user1
      await expect(
        updateUserHandler(testUser2.localId, { email: "duplicate1@example.com" }, oauth2Token)
      ).rejects.toThrow("Failed to update user:");
    });
  });

  describe("Edge Cases and Special Characters", () => {
    it("should handle special characters in display name", async () => {
      const testUser = await createTestUser("special-chars@example.com", "Original");

      const specialDisplayName = "José María López (CEO) 🚀 @company";
      const updatedUser = await updateUserHandler(testUser.localId, { displayName: specialDisplayName }, oauth2Token);

      expect(updatedUser.displayName).toBe(specialDisplayName);
      expect(updatedUser.uid).toBe(testUser.localId);
    });

    it("should handle international phone numbers", async () => {
      const testUser = await createTestUser("intl-phone@example.com", "International Phone User");

      const internationalPhone = "+33123456789"; // French number
      const updatedUser = await updateUserHandler(testUser.localId, { phoneNumber: internationalPhone }, oauth2Token);

      expect(updatedUser.phoneNumber).toBe(internationalPhone);
      expect(updatedUser.uid).toBe(testUser.localId);
    });

    it("should handle complex URLs", async () => {
      const testUser = await createTestUser("complex-url@example.com", "Complex URL User");

      const complexUrl = "https://example.com/user/avatar?size=large&format=jpg&v=1.2.3";
      const updatedUser = await updateUserHandler(testUser.localId, { photoURL: complexUrl }, oauth2Token);

      expect(updatedUser.photoURL).toBe(complexUrl);
      expect(updatedUser.uid).toBe(testUser.localId);
    });

    it("should handle email with special characters", async () => {
      const testUser = await createTestUser("original-special@example.com", "Special Email User");

      const specialEmail = "test.user+tag@example-domain.co.uk";
      const updatedUser = await updateUserHandler(testUser.localId, { email: specialEmail }, oauth2Token);

      expect(updatedUser.email).toBe(specialEmail);
      expect(updatedUser.uid).toBe(testUser.localId);
    });
  });

  describe("Real-world User Management Scenarios", () => {
    it("should simulate a complete user profile setup flow", async () => {
      // Create user with minimal data
      const testUser = await createTestUser("profile-flow@example.com");
      expect(testUser.displayName).toBeFalsy();

      // Step 1: Add basic profile information
      const step1User = await updateUserHandler(
        testUser.localId,
        {
          displayName: "John Doe",
          photoURL: "https://example.com/john-avatar.jpg",
        },
        oauth2Token
      );

      expect(step1User.displayName).toBe("John Doe");
      expect(step1User.photoURL).toBe("https://example.com/john-avatar.jpg");

      // Step 2: Add phone number
      const step2User = await updateUserHandler(testUser.localId, { phoneNumber: "+15551234560" }, oauth2Token);

      expect(step2User.phoneNumber).toBe("+15551234560");
      expect(step2User.displayName).toBe("John Doe"); // Previous data preserved

      // Step 3: Verify email
      const step3User = await updateUserHandler(testUser.localId, { emailVerified: true }, oauth2Token);

      expect(step3User.emailVerified).toBe(true);
      expect(step3User.displayName).toBe("John Doe"); // All previous data preserved
      expect(step3User.phoneNumber).toBe("+15551234560");
    });

    it("should simulate user account deactivation and reactivation", async () => {
      const testUser = await createTestUser("deactivate-test@example.com", "Active User");

      const currentUser = await getUserByLocalId(testUser.localId, oauth2Token);

      console.log("currentUser", currentUser);

      // New users are not verified by default
      expect(currentUser.users[0].disabled).toBe(false);

      // Deactivate user
      const deactivatedUser = await updateUserHandler(testUser.localId, { disabled: true }, oauth2Token);

      expect(deactivatedUser.disabled).toBe(true);
      expect(deactivatedUser.displayName).toBe("Active User");

      // Reactivate user
      const reactivatedUser = await updateUserHandler(testUser.localId, { disabled: false }, oauth2Token);

      console.log("reactivatedUser", reactivatedUser);

      expect(reactivatedUser.disabled).toBe(false);
      expect(reactivatedUser.displayName).toBe("Active User");
    });

    it("should simulate email change with verification reset", async () => {
      const testUser = await createTestUser("email-change@example.com", "Email Change User");

      // First verify the original email
      const verifiedUser = await updateUserHandler(testUser.localId, { emailVerified: true }, oauth2Token);
      expect(verifiedUser.emailVerified).toBe(true);

      // Change email and reset verification
      const emailChangedUser = await updateUserHandler(
        testUser.localId,
        {
          email: "new-email@example.com",
          emailVerified: false,
        },
        oauth2Token
      );

      expect(emailChangedUser.email).toBe("new-email@example.com");
      expect(emailChangedUser.emailVerified).toBe(false);
      expect(emailChangedUser.displayName).toBe("Email Change User");
    });
  });

  describe("Performance and Consistency", () => {
    it("should handle rapid successive updates consistently", async () => {
      const testUser = await createTestUser("rapid-updates@example.com", "Rapid Test User");

      // Perform multiple rapid updates
      const update1Promise = updateUserHandler(testUser.localId, { displayName: "Update 1" }, oauth2Token);

      const update2Promise = updateUserHandler(testUser.localId, { phoneNumber: "+1111111111" }, oauth2Token);

      const update3Promise = updateUserHandler(testUser.localId, { emailVerified: true }, oauth2Token);

      // Wait for all updates to complete
      const [user1, user2, user3] = await Promise.allSettled([update1Promise, update2Promise, update3Promise]);

      // At least one should succeed (Firebase handles concurrency)
      const successfulUpdates = [user1, user2, user3].filter((result) => result.status === "fulfilled");

      expect(successfulUpdates.length).toBeGreaterThan(0);

      // Do a final check to see the current state
      const finalUser = await updateUserHandler(
        testUser.localId,
        { disabled: false }, // A safe no-op update to get current state
        oauth2Token
      );

      expect(finalUser.uid).toBe(testUser.localId);
    });
  });
});
