import { describe, it, expect, afterAll } from "vitest";
import { setCustomUserClaimsHandler } from "../../src/rest-api/set-custom-user-claims.js";
import { getOauth2AccessTokenHandler } from "../../src/google-auth/get-oauth-2-token.js";
import serviceAccountKey from "../service-account-key.json";
import { env } from "process";
import { config } from "dotenv";
import { KVNamespace } from "@cloudflare/workers-types";
import { addANewUserWithSignUp, deleteUser, getUserByLocalId } from "./utils.js";

config({ path: "test/.env" });

/**
 * Creates a mock KV namespace for testing purposes.
 * @returns A mock KV namespace.
 */
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

describe.skipIf(doNotRunIntegrationTests)("Set Custom User Claims Handler Integration Tests", async () => {
  // Mock KV namespace
  const KV_NAMESPACE = createMockKV() as KVNamespace;

  // Get OAuth2 token for Firebase Admin API
  const oauth2Token = await getOauth2AccessTokenHandler(serviceAccountKey, 3000, KV_NAMESPACE);
  console.log("OAuth2 token obtained for custom claims tests");

  const userEmail = "test-custom-claims@example.com";
  const userDisplayName = "Custom Claims Test User";

  // Create a test user
  const testUser = await addANewUserWithSignUp(oauth2Token, userEmail, userDisplayName);
  console.log("Test user created:", testUser.localId);

  it("Should set basic custom claims successfully", async () => {
    const basicClaims = {
      role: "admin",
      department: "engineering",
      level: 5,
      isActive: true,
    };

    // Set custom claims
    await setCustomUserClaimsHandler(testUser.localId, basicClaims, oauth2Token);

    // Wait a moment for the update to propagate
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Verify claims were set by getting user data
    const userData = await getUserByLocalId(testUser.localId, oauth2Token);
    const user = userData.users[0];

    expect(user).toBeDefined();
    expect(user.customAttributes).toBeDefined();

    const retrievedClaims = JSON.parse(user.customAttributes);
    expect(retrievedClaims.role).toBe("admin");
    expect(retrievedClaims.department).toBe("engineering");
    expect(retrievedClaims.level).toBe(5);
    expect(retrievedClaims.isActive).toBe(true);
  }, 15000);

  it("Should handle nested object claims", async () => {
    const nestedClaims = {
      role: "user",
      metadata: {
        createdBy: "admin",
        source: "integration-test",
        tags: ["test", "automated"],
      },
      permissions: {
        read: ["posts", "comments"],
        write: ["posts"],
      },
    };

    await setCustomUserClaimsHandler(testUser.localId, nestedClaims, oauth2Token);

    await new Promise((resolve) => setTimeout(resolve, 1000));

    const userData = await getUserByLocalId(testUser.localId, oauth2Token);
    const retrievedClaims = JSON.parse(userData.users[0].customAttributes);

    expect(retrievedClaims.role).toBe("user");
    expect(retrievedClaims.metadata).toEqual({
      createdBy: "admin",
      source: "integration-test",
      tags: ["test", "automated"],
    });
    expect(retrievedClaims.permissions.read).toEqual(["posts", "comments"]);
    expect(retrievedClaims.permissions.write).toEqual(["posts"]);
  }, 15000);

  it("Should handle array claims", async () => {
    const arrayClaims = {
      roles: ["user", "moderator"],
      features: ["beta", "premium", "analytics"],
      tags: ["vip", "early-adopter"],
    };

    await setCustomUserClaimsHandler(testUser.localId, arrayClaims, oauth2Token);

    await new Promise((resolve) => setTimeout(resolve, 1000));

    const userData = await getUserByLocalId(testUser.localId, oauth2Token);
    const retrievedClaims = JSON.parse(userData.users[0].customAttributes);

    expect(retrievedClaims.roles).toEqual(["user", "moderator"]);
    expect(retrievedClaims.features).toEqual(["beta", "premium", "analytics"]);
    expect(retrievedClaims.tags).toEqual(["vip", "early-adopter"]);
  }, 15000);

  it("Should handle organization and subscription claims", async () => {
    const orgClaims = {
      organization: "acme-corp",
      organizationId: "org-12345",
      subscription: {
        plan: "enterprise",
        expires: "2024-12-31",
        features: ["unlimited-users", "advanced-analytics", "priority-support"],
      },
      permissions: ["users:read", "users:write", "billing:read", "settings:write"],
    };

    await setCustomUserClaimsHandler(testUser.localId, orgClaims, oauth2Token);

    await new Promise((resolve) => setTimeout(resolve, 1000));

    const userData = await getUserByLocalId(testUser.localId, oauth2Token);
    const retrievedClaims = JSON.parse(userData.users[0].customAttributes);

    expect(retrievedClaims.organization).toBe("acme-corp");
    expect(retrievedClaims.organizationId).toBe("org-12345");
    expect(retrievedClaims.subscription.plan).toBe("enterprise");
    expect(retrievedClaims.subscription.expires).toBe("2024-12-31");
    expect(retrievedClaims.permissions).toEqual(["users:read", "users:write", "billing:read", "settings:write"]);
  }, 15000);

  it("Should clear all custom claims when passed null", async () => {
    // First set some claims
    await setCustomUserClaimsHandler(testUser.localId, { role: "temp" }, oauth2Token);
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Verify claims are set
    let userData = await getUserByLocalId(testUser.localId, oauth2Token);
    expect(userData.users[0].customAttributes).toBeDefined();
    expect(JSON.parse(userData.users[0].customAttributes).role).toBe("temp");

    // Clear claims by passing null
    await setCustomUserClaimsHandler(testUser.localId, null, oauth2Token);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Verify claims are cleared
    userData = await getUserByLocalId(testUser.localId, oauth2Token);

    // When claims are cleared, customAttributes should be an empty object or undefined
    const customAttributes = userData.users[0].customAttributes;
    if (customAttributes) {
      const claims = JSON.parse(customAttributes);
      expect(Object.keys(claims)).toHaveLength(0);
    }
  }, 20000);

  it("Should update existing claims without losing other user data", async () => {
    // Set initial claims
    const initialClaims = { role: "user", level: 1 };
    await setCustomUserClaimsHandler(testUser.localId, initialClaims, oauth2Token);
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Update claims
    const updatedClaims = { role: "admin", level: 10, newField: "added" };
    await setCustomUserClaimsHandler(testUser.localId, updatedClaims, oauth2Token);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Verify user data is intact and claims are updated
    const userData = await getUserByLocalId(testUser.localId, oauth2Token);
    const user = userData.users[0];

    // Original user data should be preserved
    expect(user.email).toBe(userEmail);
    expect(user.displayName).toBe(userDisplayName);
    expect(user.localId).toBe(testUser.localId);

    // Claims should be updated (completely replaced, not merged)
    const retrievedClaims = JSON.parse(user.customAttributes);
    expect(retrievedClaims.role).toBe("admin");
    expect(retrievedClaims.level).toBe(10);
    expect(retrievedClaims.newField).toBe("added");
  }, 15000);

  describe("Error scenarios", () => {
    it("Should reject claims with reserved Firebase claim names", async () => {
      const invalidClaims = {
        role: "admin", // Valid
        firebase: { tenant: "test" }, // Invalid - reserved
      };

      await expect(setCustomUserClaimsHandler(testUser.localId, invalidClaims, oauth2Token)).rejects.toThrow(
        "Reserved claim name: firebase is not allowed in custom user claims"
      );
    }, 10000);

    it("Should reject claims with reserved OIDC claim names", async () => {
      const invalidClaims = {
        role: "admin", // Valid
        email: "fake@example.com", // Invalid - reserved
      };

      await expect(setCustomUserClaimsHandler(testUser.localId, invalidClaims, oauth2Token)).rejects.toThrow(
        "Reserved claim name: email is not allowed in custom user claims"
      );
    }, 10000);

    it("Should reject claims that are too large", async () => {
      const largeClaims = {
        data: "x".repeat(1000), // This will exceed 1000 bytes with JSON overhead
      };

      await expect(setCustomUserClaimsHandler(testUser.localId, largeClaims, oauth2Token)).rejects.toThrow(
        /Custom user claims are too large/
      );
    }, 10000);

    it("Should handle invalid user ID gracefully", async () => {
      const validClaims = { role: "admin" };
      const invalidUserId = "non-existent-user-id";

      await expect(setCustomUserClaimsHandler(invalidUserId, validClaims, oauth2Token)).rejects.toThrow(
        /Failed to set custom user claims/
      );
    }, 10000);

    it("Should handle invalid OAuth2 token gracefully", async () => {
      const validClaims = { role: "admin" };
      const invalidToken = "invalid-oauth2-token";

      await expect(setCustomUserClaimsHandler(testUser.localId, validClaims, invalidToken)).rejects.toThrow(
        /Failed to set custom user claims/
      );
    }, 10000);
  });

  describe("Real-world scenarios", () => {
    it("Should handle typical role-based access control claims", async () => {
      const rbacClaims = {
        role: "project_manager",
        department: "product",
        permissions: ["projects:read", "projects:write", "users:read", "reports:read"],
        projects: ["project-alpha", "project-beta"],
        level: 7,
      };

      await setCustomUserClaimsHandler(testUser.localId, rbacClaims, oauth2Token);
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const userData = await getUserByLocalId(testUser.localId, oauth2Token);
      const retrievedClaims = JSON.parse(userData.users[0].customAttributes);

      expect(retrievedClaims.role).toBe("project_manager");
      expect(retrievedClaims.permissions).toHaveLength(4);
      expect(retrievedClaims.projects).toEqual(["project-alpha", "project-beta"]);
    }, 15000);

    it("Should handle multi-tenant application claims", async () => {
      const tenantClaims = {
        tenantId: "tenant-12345",
        tenantName: "Acme Corporation",
        role: "admin",
        permissions: {
          users: ["create", "read", "update", "delete"],
          billing: ["read", "update"],
          settings: ["read", "update"],
        },
        features: ["advanced-reporting", "api-access", "sso"],
      };

      await setCustomUserClaimsHandler(testUser.localId, tenantClaims, oauth2Token);
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const userData = await getUserByLocalId(testUser.localId, oauth2Token);
      const retrievedClaims = JSON.parse(userData.users[0].customAttributes);

      expect(retrievedClaims.tenantId).toBe("tenant-12345");
      expect(retrievedClaims.tenantName).toBe("Acme Corporation");
      expect(retrievedClaims.permissions.users).toEqual(["create", "read", "update", "delete"]);
      expect(retrievedClaims.features).toContain("sso");
    }, 15000);

    it("Should handle subscription and feature flag claims", async () => {
      const subscriptionClaims = {
        subscription: {
          id: "sub_1234567890",
          status: "active",
          plan: "professional",
          billingCycle: "monthly",
          expiresAt: "2024-12-31T23:59:59Z",
        },
        features: {
          exportData: true,
          advancedAnalytics: true,
          apiAccess: true,
          customBranding: false,
          prioritySupport: true,
        },
        limits: {
          projects: 50,
          teamMembers: 10,
          storageGB: 100,
        },
      };

      await setCustomUserClaimsHandler(testUser.localId, subscriptionClaims, oauth2Token);
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const userData = await getUserByLocalId(testUser.localId, oauth2Token);
      const retrievedClaims = JSON.parse(userData.users[0].customAttributes);

      expect(retrievedClaims.subscription.plan).toBe("professional");
      expect(retrievedClaims.features.apiAccess).toBe(true);
      expect(retrievedClaims.features.customBranding).toBe(false);
      expect(retrievedClaims.limits.projects).toBe(50);
    }, 15000);
  });

  // Clean up test user
  afterAll(async () => {
    try {
      await deleteUser(testUser.localId, oauth2Token);
      console.log("Test user cleaned up:", testUser.localId);
    } catch (error) {
      console.error("Failed to clean up test user:", error);
    }
  });
});
