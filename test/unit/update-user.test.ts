import { describe, it, expect, vi, beforeEach } from "vitest";
import { updateUserHandler } from "../../src/rest-api/update-user.js";
import type { UpdateRequest } from "../../src/types.js";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("updateUserHandler", () => {
  const validUid = "test-user-123";
  const validOAuth2Token = "valid-oauth2-token";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Property Validation", () => {
    it("should reject invalid properties", async () => {
      const invalidRequest = {
        displayName: "John Doe",
        invalidProperty: "should not be allowed",
      } as any;

      await expect(updateUserHandler(validUid, invalidRequest, validOAuth2Token)).rejects.toThrow(
        "Invalid properties provided: invalidProperty"
      );
    });

    it("should reject non-boolean disabled", async () => {
      await expect(updateUserHandler(validUid, { disabled: "true" as any }, validOAuth2Token)).rejects.toThrow(
        "disabled must be a boolean"
      );
    });

    it("should reject non-string displayName", async () => {
      await expect(updateUserHandler(validUid, { displayName: 123 as any }, validOAuth2Token)).rejects.toThrow(
        "displayName must be a string or null"
      );
    });

    it("should reject invalid email format", async () => {
      await expect(updateUserHandler(validUid, { email: "invalid-email" }, validOAuth2Token)).rejects.toThrow(
        "Invalid email format"
      );
    });

    it("should reject non-string email", async () => {
      await expect(updateUserHandler(validUid, { email: 123 as any }, validOAuth2Token)).rejects.toThrow(
        "email must be a string"
      );
    });

    it("should reject non-boolean emailVerified", async () => {
      await expect(updateUserHandler(validUid, { emailVerified: "true" as any }, validOAuth2Token)).rejects.toThrow(
        "emailVerified must be a boolean"
      );
    });

    it("should reject short passwords", async () => {
      await expect(updateUserHandler(validUid, { password: "123" }, validOAuth2Token)).rejects.toThrow(
        "password must be at least 6 characters long"
      );
    });

    it("should reject non-string passwords", async () => {
      await expect(updateUserHandler(validUid, { password: 123456 as any }, validOAuth2Token)).rejects.toThrow(
        "password must be a string"
      );
    });

    it("should reject non-string phoneNumber", async () => {
      await expect(updateUserHandler(validUid, { phoneNumber: 123 as any }, validOAuth2Token)).rejects.toThrow(
        "phoneNumber must be a string or null"
      );
    });

    it("should reject invalid photoURL", async () => {
      await expect(updateUserHandler(validUid, { photoURL: "not-a-url" }, validOAuth2Token)).rejects.toThrow(
        "photoURL must be a valid URL"
      );
    });

    it("should reject non-string photoURL", async () => {
      await expect(updateUserHandler(validUid, { photoURL: 123 as any }, validOAuth2Token)).rejects.toThrow(
        "photoURL must be a string or null"
      );
    });

    it("should reject invalid multiFactor", async () => {
      await expect(updateUserHandler(validUid, { multiFactor: "invalid" as any }, validOAuth2Token)).rejects.toThrow(
        "multiFactor must be an object or null"
      );
    });

    it("should reject invalid enrolledFactors", async () => {
      await expect(
        updateUserHandler(validUid, { multiFactor: { enrolledFactors: "invalid" as any } }, validOAuth2Token)
      ).rejects.toThrow("multiFactor.enrolledFactors must be an array or null");
    });

    it("should reject null providerToLink", async () => {
      await expect(updateUserHandler(validUid, { providerToLink: null as any }, validOAuth2Token)).rejects.toThrow(
        "providerToLink must be a UserProvider object"
      );
    });

    it("should reject non-array providersToUnlink", async () => {
      await expect(
        updateUserHandler(validUid, { providersToUnlink: "invalid" as any }, validOAuth2Token)
      ).rejects.toThrow("providersToUnlink must be an array");
    });

    it("should reject providersToUnlink with non-string elements", async () => {
      await expect(
        updateUserHandler(validUid, { providersToUnlink: ["valid", 123] as any }, validOAuth2Token)
      ).rejects.toThrow("all providers in providersToUnlink must be strings");
    });
  });

  describe("Valid Properties", () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ users: [{ uid: validUid }] }),
      });
    });

    it("should accept valid boolean disabled", async () => {
      await expect(updateUserHandler(validUid, { disabled: true }, validOAuth2Token)).resolves.not.toThrow();
    });

    it("should accept valid string displayName", async () => {
      await expect(updateUserHandler(validUid, { displayName: "John Doe" }, validOAuth2Token)).resolves.not.toThrow();
    });

    it("should accept null displayName", async () => {
      await expect(updateUserHandler(validUid, { displayName: null }, validOAuth2Token)).resolves.not.toThrow();
    });

    it("should accept valid email", async () => {
      await expect(updateUserHandler(validUid, { email: "user@example.com" }, validOAuth2Token)).resolves.not.toThrow();
    });

    it("should accept valid boolean emailVerified", async () => {
      await expect(updateUserHandler(validUid, { emailVerified: true }, validOAuth2Token)).resolves.not.toThrow();
    });

    it("should accept valid password", async () => {
      await expect(updateUserHandler(validUid, { password: "password123" }, validOAuth2Token)).resolves.not.toThrow();
    });

    it("should accept valid phoneNumber", async () => {
      await expect(
        updateUserHandler(validUid, { phoneNumber: "+12345678900" }, validOAuth2Token)
      ).resolves.not.toThrow();
    });

    it("should accept null phoneNumber", async () => {
      await expect(updateUserHandler(validUid, { phoneNumber: null }, validOAuth2Token)).resolves.not.toThrow();
    });

    it("should accept valid photoURL", async () => {
      await expect(
        updateUserHandler(validUid, { photoURL: "https://example.com/photo.jpg" }, validOAuth2Token)
      ).resolves.not.toThrow();
    });

    it("should accept null photoURL", async () => {
      await expect(updateUserHandler(validUid, { photoURL: null }, validOAuth2Token)).resolves.not.toThrow();
    });

    it("should accept valid multiFactor", async () => {
      await expect(
        updateUserHandler(validUid, { multiFactor: { enrolledFactors: [] } }, validOAuth2Token)
      ).resolves.not.toThrow();
    });

    it("should accept null multiFactor", async () => {
      await expect(updateUserHandler(validUid, { multiFactor: null as any }, validOAuth2Token)).resolves.not.toThrow();
    });

    it("should accept valid providerToLink", async () => {
      await expect(
        updateUserHandler(validUid, { providerToLink: { providerId: "google.com", uid: "123" } }, validOAuth2Token)
      ).resolves.not.toThrow();
    });

    it("should accept valid providersToUnlink", async () => {
      await expect(
        updateUserHandler(validUid, { providersToUnlink: ["facebook.com"] }, validOAuth2Token)
      ).resolves.not.toThrow();
    });
  });

  describe("API Calls", () => {
    it("should make correct API call", async () => {
      const updateRequest: UpdateRequest = {
        displayName: "John Doe",
        email: "john@example.com",
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: vi
          .fn()
          .mockResolvedValue({ users: [{ uid: validUid, displayName: "John Doe", email: "john@example.com" }] }),
      });

      await updateUserHandler(validUid, updateRequest, validOAuth2Token);

      expect(mockFetch).toHaveBeenCalledWith("https://identitytoolkit.googleapis.com/v1/accounts:update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${validOAuth2Token}`,
        },
        body: JSON.stringify({
          displayName: "John Doe",
          email: "john@example.com",
          localId: validUid,
        }),
      });
    });

    it("should transform provider linking correctly", async () => {
      const updateRequest: UpdateRequest = {
        providerToLink: {
          providerId: "google.com",
          uid: "google-uid-123",
        },
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ users: [{ uid: validUid }] }),
      });

      await updateUserHandler(validUid, updateRequest, validOAuth2Token);

      const callArgs = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);

      expect(requestBody).toEqual({
        localId: validUid,
        linkProviderUserInfo: {
          providerId: "google.com",
          uid: "google-uid-123",
        },
      });

      // Ensure original field is removed
      expect(requestBody.providerToLink).toBeUndefined();
    });

    it("should transform provider unlinking correctly", async () => {
      const updateRequest: UpdateRequest = {
        providersToUnlink: ["facebook.com", "twitter.com"],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ users: [{ uid: validUid }] }),
      });

      await updateUserHandler(validUid, updateRequest, validOAuth2Token);

      const callArgs = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);

      expect(requestBody).toEqual({
        localId: validUid,
        deleteProvider: ["facebook.com", "twitter.com"],
      });

      // Ensure original field is removed
      expect(requestBody.providersToUnlink).toBeUndefined();
    });

    it("should handle HTTP errors with status code", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        text: vi.fn().mockResolvedValue("Invalid user ID"),
      });

      await expect(updateUserHandler(validUid, { displayName: "John" }, validOAuth2Token)).rejects.toThrow(
        "Failed to update user: 400 Bad Request - Invalid user ID"
      );
    });

    it("should handle HTTP errors with Firebase error details", async () => {
      const firebaseError = {
        error: {
          message: "EMAIL_EXISTS",
          code: 400,
        },
      };

      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        text: vi.fn().mockResolvedValue(JSON.stringify(firebaseError)),
      });

      await expect(updateUserHandler(validUid, { displayName: "John" }, validOAuth2Token)).rejects.toThrow(
        'Failed to update user: 400 Bad Request\n{\n  "error": {\n    "message": "EMAIL_EXISTS",\n    "code": 400\n  }\n}'
      );
    });

    it("should handle network errors", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      await expect(updateUserHandler(validUid, { displayName: "John" }, validOAuth2Token)).rejects.toThrow(
        "Network error"
      );
    });

    it("should extract user from Firebase response format", async () => {
      const mockUserRecord = { uid: validUid, displayName: "John Doe" };
      const mockFirebaseResponse = { users: [mockUserRecord] };

      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockFirebaseResponse),
      });

      const result = await updateUserHandler(validUid, { displayName: "John Doe" }, validOAuth2Token);
      expect(result).toEqual(mockUserRecord);
    });

    it("should handle invalid response format", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({}), // No users array
      });

      await expect(updateUserHandler(validUid, { displayName: "John" }, validOAuth2Token)).rejects.toThrow(
        "Invalid response from Firebase API - no user data returned"
      );
    });

    it("should handle empty users array in response", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ users: [] }),
      });

      await expect(updateUserHandler(validUid, { displayName: "John" }, validOAuth2Token)).rejects.toThrow(
        "Invalid response from Firebase API - no user data returned"
      );
    });
  });
});
