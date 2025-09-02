import { describe, it, expect, vi, beforeEach } from "vitest";
import { updateUserHandler } from "../../src/rest-api/update-user.js";
import { getUserHandler } from "../../src/rest-api/get-user.js";
import type { UpdateRequest, UserRecord } from "../../src/types.js";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock getUserHandler
vi.mock("../../src/rest-api/get-user.js", () => ({
  getUserHandler: vi.fn(),
}));

const mockGetUserHandler = vi.mocked(getUserHandler);

describe("updateUserHandler", () => {
  const validUid = "test-user-123";
  const validOAuth2Token = "valid-oauth2-token";

  const mockUpdatedUserRecord: UserRecord = {
    uid: validUid,
    email: "updated@example.com",
    emailVerified: true,
    displayName: "Updated User",
    photoURL: "https://example.com/updated-photo.jpg",
    phoneNumber: "+1234567890",
    disabled: false,
    customClaims: { role: "admin" },
    providerData: [
      {
        uid: validUid,
        providerId: "password",
        email: "updated@example.com",
        displayName: "Updated User",
        photoURL: "https://example.com/photo.jpg",
        phoneNumber: "+1234567890",
        toJSON: () => ({}),
      },
    ],
    metadata: {
      creationTime: "1609459200000",
      lastSignInTime: "1640995200000",
      lastRefreshTime: null,
      toJSON: () => ({}),
    },
    toJSON: () => ({}),
  };

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

    it("should reject non-string phoneNumber", async () => {
      await expect(updateUserHandler(validUid, { phoneNumber: 123 as any }, validOAuth2Token)).rejects.toThrow(
        "phoneNumber must be a string or null"
      );
    });

    it("should reject invalid photoURL", async () => {
      await expect(updateUserHandler(validUid, { photoURL: "invalid-url" }, validOAuth2Token)).rejects.toThrow(
        "photoURL must be a valid URL"
      );
    });

    it("should accept null values for clearable fields", async () => {
      const validRequest: UpdateRequest = {
        displayName: null,
        phoneNumber: null,
        photoURL: null,
      };

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ localId: validUid }),
      };

      mockFetch.mockResolvedValue(mockResponse);
      mockGetUserHandler.mockResolvedValue(mockUpdatedUserRecord);

      await updateUserHandler(validUid, validRequest, validOAuth2Token);

      expect(mockFetch).toHaveBeenCalledWith("https://identitytoolkit.googleapis.com/v1/accounts:update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${validOAuth2Token}`,
        },
        body: JSON.stringify({
          localId: validUid,
          deleteAttribute: ["DISPLAY_NAME", "PHOTO_URL"],
          deleteProvider: ["phone"],
        }),
      });
    });
  });

  describe("Successful Updates", () => {
    beforeEach(() => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ localId: validUid }),
      };
      mockFetch.mockResolvedValue(mockResponse);
      mockGetUserHandler.mockResolvedValue(mockUpdatedUserRecord);
    });

    it("should update basic profile properties", async () => {
      const updateRequest: UpdateRequest = {
        displayName: "Updated Name",
        photoURL: "https://example.com/new-photo.jpg",
      };

      const result = await updateUserHandler(validUid, updateRequest, validOAuth2Token);

      // Verify update API call
      expect(mockFetch).toHaveBeenCalledWith("https://identitytoolkit.googleapis.com/v1/accounts:update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${validOAuth2Token}`,
        },
        body: JSON.stringify({
          displayName: "Updated Name",
          localId: validUid,
          photoUrl: "https://example.com/new-photo.jpg",
        }),
      });

      // Verify getUserHandler was called
      expect(mockGetUserHandler).toHaveBeenCalledWith(validUid, validOAuth2Token);

      // Verify result is from getUserHandler
      expect(result).toBe(mockUpdatedUserRecord);
    });

    it("should update authentication properties", async () => {
      const updateRequest: UpdateRequest = {
        email: "newemail@example.com",
        emailVerified: false,
        password: "newPassword123",
      };

      const result = await updateUserHandler(validUid, updateRequest, validOAuth2Token);

      expect(mockFetch).toHaveBeenCalledWith("https://identitytoolkit.googleapis.com/v1/accounts:update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${validOAuth2Token}`,
        },
        body: JSON.stringify({
          email: "newemail@example.com",
          emailVerified: false,
          password: "newPassword123",
          localId: validUid,
        }),
      });

      expect(mockGetUserHandler).toHaveBeenCalledWith(validUid, validOAuth2Token);
      expect(result).toBe(mockUpdatedUserRecord);
    });

    it("should update disabled status", async () => {
      const updateRequest: UpdateRequest = {
        disabled: true,
      };

      const result = await updateUserHandler(validUid, updateRequest, validOAuth2Token);

      expect(mockFetch).toHaveBeenCalledWith("https://identitytoolkit.googleapis.com/v1/accounts:update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${validOAuth2Token}`,
        },
        body: JSON.stringify({
          localId: validUid,
          disableUser: true,
        }),
      });

      expect(result).toBe(mockUpdatedUserRecord);
    });

    it("should handle provider linking", async () => {
      const updateRequest: UpdateRequest = {
        providerToLink: {
          providerId: "google.com",
          uid: "google-123",
          email: "user@gmail.com",
        },
      };

      const result = await updateUserHandler(validUid, updateRequest, validOAuth2Token);

      expect(mockFetch).toHaveBeenCalledWith("https://identitytoolkit.googleapis.com/v1/accounts:update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${validOAuth2Token}`,
        },
        body: JSON.stringify({
          localId: validUid,
          linkProviderUserInfo: {
            providerId: "google.com",
            uid: "google-123",
            email: "user@gmail.com",
          },
        }),
      });

      expect(result).toBe(mockUpdatedUserRecord);
    });

    it("should handle provider unlinking", async () => {
      const updateRequest: UpdateRequest = {
        providersToUnlink: ["facebook.com", "twitter.com"],
      };

      const result = await updateUserHandler(validUid, updateRequest, validOAuth2Token);

      expect(mockFetch).toHaveBeenCalledWith("https://identitytoolkit.googleapis.com/v1/accounts:update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${validOAuth2Token}`,
        },
        body: JSON.stringify({
          localId: validUid,
          deleteProvider: ["facebook.com", "twitter.com"],
        }),
      });

      expect(result).toBe(mockUpdatedUserRecord);
    });

    it("should handle both provider linking and unlinking", async () => {
      const updateRequest: UpdateRequest = {
        providerToLink: {
          providerId: "google.com",
          uid: "google-456",
        },
        providersToUnlink: ["facebook.com"],
      };

      const result = await updateUserHandler(validUid, updateRequest, validOAuth2Token);

      expect(mockFetch).toHaveBeenCalledWith("https://identitytoolkit.googleapis.com/v1/accounts:update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${validOAuth2Token}`,
        },
        body: JSON.stringify({
          localId: validUid,
          linkProviderUserInfo: {
            providerId: "google.com",
            uid: "google-456",
          },
          deleteProvider: ["facebook.com"],
        }),
      });

      expect(result).toBe(mockUpdatedUserRecord);
    });

    it("should handle comprehensive updates", async () => {
      const updateRequest: UpdateRequest = {
        displayName: "Complete User",
        email: "complete@example.com",
        emailVerified: true,
        phoneNumber: "+1987654321",
        photoURL: "https://example.com/complete-photo.jpg",
        disabled: false,
      };

      const result = await updateUserHandler(validUid, updateRequest, validOAuth2Token);

      expect(mockFetch).toHaveBeenCalledWith("https://identitytoolkit.googleapis.com/v1/accounts:update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${validOAuth2Token}`,
        },
        body: JSON.stringify({
          displayName: "Complete User",
          email: "complete@example.com",
          emailVerified: true,
          phoneNumber: "+1987654321",
          localId: validUid,
          photoUrl: "https://example.com/complete-photo.jpg",
          disableUser: false,
        }),
      });

      expect(result).toBe(mockUpdatedUserRecord);
    });
  });

  describe("Firebase API Error Handling", () => {
    it("should handle HTTP 400 errors with detailed message", async () => {
      const mockResponse = {
        ok: false,
        status: 400,
        statusText: "Bad Request",
        text: vi.fn().mockResolvedValue(
          JSON.stringify({
            error: {
              code: 400,
              message: "INVALID_ID_TOKEN",
              errors: [
                {
                  message: "INVALID_ID_TOKEN",
                  domain: "global",
                  reason: "invalid",
                },
              ],
            },
          })
        ),
      };

      mockFetch.mockResolvedValue(mockResponse);

      const updateRequest: UpdateRequest = { displayName: "Test" };

      await expect(updateUserHandler(validUid, updateRequest, validOAuth2Token)).rejects.toThrow(
        'Failed to update user: 400 Bad Request\n{\n  "error": {\n    "code": 400,\n    "message": "INVALID_ID_TOKEN",\n    "errors": [\n      {\n        "message": "INVALID_ID_TOKEN",\n        "domain": "global",\n        "reason": "invalid"\n      }\n    ]\n  }\n}'
      );

      // getUserHandler should not be called when update fails
      expect(mockGetUserHandler).not.toHaveBeenCalled();
    });

    it("should handle HTTP 401 errors", async () => {
      const mockResponse = {
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        text: vi.fn().mockResolvedValue("Unauthorized access"),
      };

      mockFetch.mockResolvedValue(mockResponse);

      const updateRequest: UpdateRequest = { displayName: "Test" };

      await expect(updateUserHandler(validUid, updateRequest, validOAuth2Token)).rejects.toThrow(
        "Failed to update user: 401 Unauthorized - Unauthorized access"
      );

      expect(mockGetUserHandler).not.toHaveBeenCalled();
    });

    it("should handle HTTP 404 errors (user not found)", async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: vi.fn().mockResolvedValue(
          JSON.stringify({
            error: {
              message: "USER_NOT_FOUND",
            },
          })
        ),
      };

      mockFetch.mockResolvedValue(mockResponse);

      const updateRequest: UpdateRequest = { displayName: "Test" };

      await expect(updateUserHandler(validUid, updateRequest, validOAuth2Token)).rejects.toThrow(
        'Failed to update user: 404 Not Found\n{\n  "error": {\n    "message": "USER_NOT_FOUND"\n  }\n}'
      );
    });

    it("should handle network errors", async () => {
      const networkError = new Error("Network connection failed");
      mockFetch.mockRejectedValue(networkError);

      const updateRequest: UpdateRequest = { displayName: "Test" };

      await expect(updateUserHandler(validUid, updateRequest, validOAuth2Token)).rejects.toThrow(
        "Network connection failed"
      );

      expect(mockGetUserHandler).not.toHaveBeenCalled();
    });
  });

  describe("Response Validation", () => {
    it("should handle user ID mismatch in response", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ localId: "different-user-id" }),
      };

      mockFetch.mockResolvedValue(mockResponse);

      const updateRequest: UpdateRequest = { displayName: "Test" };

      await expect(updateUserHandler(validUid, updateRequest, validOAuth2Token)).rejects.toThrow(
        "Invalid response from Firebase API - user ID mismatch"
      );

      expect(mockGetUserHandler).not.toHaveBeenCalled();
    });

    it("should handle malformed JSON response", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockRejectedValue(new SyntaxError("Unexpected token")),
      };

      mockFetch.mockResolvedValue(mockResponse);

      const updateRequest: UpdateRequest = { displayName: "Test" };

      await expect(updateUserHandler(validUid, updateRequest, validOAuth2Token)).rejects.toThrow("Unexpected token");

      expect(mockGetUserHandler).not.toHaveBeenCalled();
    });
  });

  describe("User Data Retrieval Errors", () => {
    beforeEach(() => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ localId: validUid }),
      };
      mockFetch.mockResolvedValue(mockResponse);
    });

    it("should handle getUserHandler failure after successful update", async () => {
      const getUserError = new Error("Failed to get user: 404 Not Found");
      mockGetUserHandler.mockRejectedValue(getUserError);

      const updateRequest: UpdateRequest = { displayName: "Test" };

      await expect(updateUserHandler(validUid, updateRequest, validOAuth2Token)).rejects.toThrow(
        "User updated successfully, but failed to retrieve updated data: Failed to get user: 404 Not Found"
      );

      // Verify update was called
      expect(mockFetch).toHaveBeenCalledWith(
        "https://identitytoolkit.googleapis.com/v1/accounts:update",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            displayName: "Test",
            localId: validUid,
          }),
        })
      );

      // Verify getUserHandler was attempted
      expect(mockGetUserHandler).toHaveBeenCalledWith(validUid, validOAuth2Token);
    });

    it("should handle getUserHandler network errors", async () => {
      const networkError = new Error("Network timeout");
      mockGetUserHandler.mockRejectedValue(networkError);

      const updateRequest: UpdateRequest = { email: "updated@example.com" };

      await expect(updateUserHandler(validUid, updateRequest, validOAuth2Token)).rejects.toThrow(
        "User updated successfully, but failed to retrieve updated data: Network timeout"
      );

      expect(mockFetch).toHaveBeenCalled();
      expect(mockGetUserHandler).toHaveBeenCalledWith(validUid, validOAuth2Token);
    });

    it("should handle getUserHandler authorization errors", async () => {
      const authError = new Error("Failed to get user: 401 Unauthorized");
      mockGetUserHandler.mockRejectedValue(authError);

      const updateRequest: UpdateRequest = { disabled: true };

      await expect(updateUserHandler(validUid, updateRequest, validOAuth2Token)).rejects.toThrow(
        "User updated successfully, but failed to retrieve updated data: Failed to get user: 401 Unauthorized"
      );
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty update request", async () => {
      const emptyRequest: UpdateRequest = {};

      await expect(updateUserHandler(validUid, emptyRequest, validOAuth2Token)).rejects.toThrow(
        "Request body is empty. Please provide at least one property to update."
      );
    });

    it("should handle very long UID", async () => {
      const longUid = "a".repeat(128);

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ localId: longUid }),
      };

      mockFetch.mockResolvedValue(mockResponse);
      const longUidUserRecord: UserRecord = {
        ...mockUpdatedUserRecord,
        uid: longUid,
        toJSON: () => ({}),
      };
      mockGetUserHandler.mockResolvedValue(longUidUserRecord);

      const updateRequest: UpdateRequest = { displayName: "Long UID User" };

      const result = await updateUserHandler(longUid, updateRequest, validOAuth2Token);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://identitytoolkit.googleapis.com/v1/accounts:update",
        expect.objectContaining({
          body: JSON.stringify({
            displayName: "Long UID User",
            localId: longUid,
          }),
        })
      );

      expect(mockGetUserHandler).toHaveBeenCalledWith(longUid, validOAuth2Token);
      expect(result.uid).toBe(longUid);
    });

    it("should handle special characters in properties", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ localId: validUid }),
      };

      mockFetch.mockResolvedValue(mockResponse);
      mockGetUserHandler.mockResolvedValue(mockUpdatedUserRecord);

      const updateRequest: UpdateRequest = {
        displayName: "José María López (CEO) 🚀",
        email: "test.user+tag@example-domain.com",
      };

      const result = await updateUserHandler(validUid, updateRequest, validOAuth2Token);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://identitytoolkit.googleapis.com/v1/accounts:update",
        expect.objectContaining({
          body: JSON.stringify({
            displayName: "José María López (CEO) 🚀",
            email: "test.user+tag@example-domain.com",
            localId: validUid,
          }),
        })
      );

      expect(result).toBe(mockUpdatedUserRecord);
    });
  });
});
