import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { getUserHandler } from "../../src/rest-api/get-user.js";
import type { GetAccountInfoUserResponse } from "../../src/types/firebase-admin/user-record.js";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("getUserHandler", () => {
  const validUid = "test-user-123";
  const validToken = "valid-oauth2-token";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  describe("Successful User Retrieval", () => {
    it("should return a complete UserRecord for a user with all fields", async () => {
      const mockUserData: GetAccountInfoUserResponse = {
        localId: validUid,
        email: "test@example.com",
        emailVerified: true,
        displayName: "Test User",
        photoUrl: "https://example.com/photo.jpg",
        phoneNumber: "+1234567890",
        disabled: false,
        createdAt: "1609459200000", // 2021-01-01
        lastLoginAt: "1640995200000", // 2022-01-01
        lastRefreshAt: "1672531200000", // 2023-01-01
        customAttributes: JSON.stringify({
          role: "admin",
          department: "engineering",
        }),
        providerUserInfo: [
          {
            providerId: "google.com",
            rawId: "google-123",
            email: "test@example.com",
            displayName: "Test User",
            photoUrl: "https://example.com/google-photo.jpg",
            phoneNumber: "+1234567890",
          },
          {
            providerId: "password",
            rawId: validUid,
            email: "test@example.com",
          },
        ],
      };

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ users: [mockUserData] }),
      };

      mockFetch.mockResolvedValue(mockResponse);

      const result = await getUserHandler(validUid, validToken);

      // Verify API call
      expect(mockFetch).toHaveBeenCalledOnce();
      expect(mockFetch).toHaveBeenCalledWith("https://identitytoolkit.googleapis.com/v1/accounts:lookup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${validToken}`,
        },
        body: JSON.stringify({
          localId: [validUid],
        }),
      });

      // Verify returned UserRecord
      expect(result).toEqual({
        uid: validUid,
        email: "test@example.com",
        emailVerified: true,
        displayName: "Test User",
        photoURL: "https://example.com/photo.jpg",
        phoneNumber: "+1234567890",
        disabled: false,
        customClaims: {
          role: "admin",
          department: "engineering",
        },
        providerData: [
          {
            uid: "google-123",
            providerId: "google.com",
            email: "test@example.com",
            displayName: "Test User",
            photoURL: "https://example.com/google-photo.jpg",
            phoneNumber: "+1234567890",
          },
          {
            uid: validUid,
            providerId: "password",
            email: "test@example.com",
            displayName: null,
            photoURL: null,
            phoneNumber: null,
          },
        ],
        metadata: {
          creationTime: "1609459200000",
          lastSignInTime: "1640995200000",
          lastRefreshTime: "1672531200000",
        },
      });
    });

    it("should return UserRecord with null/empty values for missing optional fields", async () => {
      const mockUserData: GetAccountInfoUserResponse = {
        localId: validUid,
        email: "minimal@example.com",
        // All other fields omitted
      };

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ users: [mockUserData] }),
      };

      mockFetch.mockResolvedValue(mockResponse);

      const result = await getUserHandler(validUid, validToken);

      expect(result).toEqual({
        uid: validUid,
        email: "minimal@example.com",
        emailVerified: false,
        displayName: null,
        photoURL: null,
        phoneNumber: null,
        disabled: false,
        customClaims: null,
        providerData: [],
        metadata: {
          creationTime: "",
          lastSignInTime: "",
          lastRefreshTime: null,
        },
      });
    });

    it("should handle users with no email (anonymous users)", async () => {
      const mockUserData: GetAccountInfoUserResponse = {
        localId: validUid,
        createdAt: "1609459200000",
        // No email field
      };

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ users: [mockUserData] }),
      };

      mockFetch.mockResolvedValue(mockResponse);

      const result = await getUserHandler(validUid, validToken);

      expect(result).toMatchObject({
        uid: validUid,
        email: null,
        emailVerified: false,
        metadata: {
          creationTime: "1609459200000",
        },
      });
    });

    it("should handle disabled users correctly", async () => {
      const mockUserData: GetAccountInfoUserResponse = {
        localId: validUid,
        email: "disabled@example.com",
        disabled: true,
      };

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ users: [mockUserData] }),
      };

      mockFetch.mockResolvedValue(mockResponse);

      const result = await getUserHandler(validUid, validToken);

      expect(result.disabled).toBe(true);
      expect(result.uid).toBe(validUid);
      expect(result.email).toBe("disabled@example.com");
    });
  });

  describe("Custom Claims Parsing", () => {
    it("should parse valid custom claims JSON", async () => {
      const customClaims = {
        role: "moderator",
        permissions: ["read", "write"],
        subscription: { tier: "premium", expires: "2024-12-31" },
      };

      const mockUserData: GetAccountInfoUserResponse = {
        localId: validUid,
        customAttributes: JSON.stringify(customClaims),
      };

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ users: [mockUserData] }),
      };

      mockFetch.mockResolvedValue(mockResponse);

      const result = await getUserHandler(validUid, validToken);

      expect(result.customClaims).toEqual(customClaims);
    });

    it("should handle invalid JSON in customAttributes gracefully", async () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const mockUserData: GetAccountInfoUserResponse = {
        localId: validUid,
        customAttributes: "{ invalid: json }", // Invalid JSON
      };

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ users: [mockUserData] }),
      };

      mockFetch.mockResolvedValue(mockResponse);

      const result = await getUserHandler(validUid, validToken);

      expect(result.customClaims).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith("Failed to parse custom attributes as JSON:", expect.any(SyntaxError));

      consoleSpy.mockRestore();
    });

    it("should handle empty customAttributes", async () => {
      const mockUserData: GetAccountInfoUserResponse = {
        localId: validUid,
        customAttributes: "",
      };

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ users: [mockUserData] }),
      };

      mockFetch.mockResolvedValue(mockResponse);

      const result = await getUserHandler(validUid, validToken);

      expect(result.customClaims).toBeNull();
    });
  });

  describe("Provider Data Transformation", () => {
    it("should handle providers with missing optional fields", async () => {
      const mockUserData: GetAccountInfoUserResponse = {
        localId: validUid,
        providerUserInfo: [
          {
            providerId: "facebook.com",
            rawId: "fb-123",
            // Missing displayName, email, photoUrl, phoneNumber
          },
          {
            providerId: "twitter.com",
            rawId: "twitter-456", // Provide rawId
            federatedId: "twitter-456",
            displayName: "Twitter User",
          },
        ],
      };

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ users: [mockUserData] }),
      };

      mockFetch.mockResolvedValue(mockResponse);

      const result = await getUserHandler(validUid, validToken);

      expect(result.providerData).toEqual([
        {
          uid: "fb-123",
          providerId: "facebook.com",
          displayName: null,
          email: null,
          photoURL: null,
          phoneNumber: null,
        },
        {
          uid: "twitter-456",
          providerId: "twitter.com",
          displayName: "Twitter User",
          email: null,
          photoURL: null,
          phoneNumber: null,
        },
      ]);
    });

    it("should handle provider with neither rawId nor federatedId", async () => {
      const mockUserData: GetAccountInfoUserResponse = {
        localId: validUid,
        providerUserInfo: [
          {
            providerId: "custom.com",
            rawId: "", // Provide empty rawId
            // No federatedId
          },
        ],
      };

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ users: [mockUserData] }),
      };

      mockFetch.mockResolvedValue(mockResponse);

      const result = await getUserHandler(validUid, validToken);

      expect(result.providerData).toEqual([
        {
          uid: "", // Falls back to empty string
          providerId: "custom.com",
          displayName: null,
          email: null,
          photoURL: null,
          phoneNumber: null,
        },
      ]);
    });
  });

  describe("Error Handling", () => {
    it("should throw error when user is not found", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ users: [] }), // Empty users array
      };

      mockFetch.mockResolvedValue(mockResponse);

      await expect(getUserHandler(validUid, validToken)).rejects.toThrow(`User not found: ${validUid}`);
    });

    it("should throw error when Firebase API returns error", async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: vi.fn().mockResolvedValue('{"error": {"message": "USER_NOT_FOUND"}}'),
      };

      mockFetch.mockResolvedValue(mockResponse);

      await expect(getUserHandler(validUid, validToken)).rejects.toThrow(
        'Failed to get user: 404 Not Found, {"error": {"message": "USER_NOT_FOUND"}}'
      );
    });

    it("should handle network errors", async () => {
      const networkError = new Error("Network connection failed");
      mockFetch.mockRejectedValue(networkError);

      await expect(getUserHandler(validUid, validToken)).rejects.toThrow("Network connection failed");
    });

    it("should handle malformed JSON response", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockRejectedValue(new SyntaxError("Unexpected token")),
      };

      mockFetch.mockResolvedValue(mockResponse);

      await expect(getUserHandler(validUid, validToken)).rejects.toThrow("Unexpected token");
    });

    it("should throw error with detailed message for various HTTP errors", async () => {
      const testCases = [
        { status: 400, statusText: "Bad Request", errorBody: '{"error":"INVALID_ID_TOKEN"}' },
        { status: 401, statusText: "Unauthorized", errorBody: '{"error":"INVALID_CREDENTIALS"}' },
        { status: 403, statusText: "Forbidden", errorBody: '{"error":"PERMISSION_DENIED"}' },
        { status: 500, statusText: "Internal Server Error", errorBody: '{"error":"INTERNAL_ERROR"}' },
      ];

      for (const testCase of testCases) {
        const mockResponse = {
          ok: false,
          status: testCase.status,
          statusText: testCase.statusText,
          text: vi.fn().mockResolvedValue(testCase.errorBody),
        };

        mockFetch.mockResolvedValue(mockResponse);

        await expect(getUserHandler(validUid, validToken)).rejects.toThrow(
          `Failed to get user: ${testCase.status} ${testCase.statusText}, ${testCase.errorBody}`
        );

        mockFetch.mockClear();
      }
    });
  });

  describe("Edge Cases", () => {
    it("should handle response with users field but null user", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ users: [null] }),
      };

      mockFetch.mockResolvedValue(mockResponse);

      await expect(getUserHandler(validUid, validToken)).rejects.toThrow(`User not found: ${validUid}`);
    });

    it("should handle response without users field", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({}), // No users field
      };

      mockFetch.mockResolvedValue(mockResponse);

      await expect(getUserHandler(validUid, validToken)).rejects.toThrow(`User not found: ${validUid}`);
    });

    it("should handle very long UID", async () => {
      const longUid = "a".repeat(128); // Very long UID
      const mockUserData: GetAccountInfoUserResponse = {
        localId: longUid,
        email: "test@example.com",
      };

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ users: [mockUserData] }),
      };

      mockFetch.mockResolvedValue(mockResponse);

      const result = await getUserHandler(longUid, validToken);

      expect(result.uid).toBe(longUid);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({ localId: [longUid] }),
        })
      );
    });

    it("should handle special characters in UID", async () => {
      const specialUid = "user-123_test@domain.com"; // UID with special chars
      const mockUserData: GetAccountInfoUserResponse = {
        localId: specialUid,
        email: "special@example.com",
      };

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ users: [mockUserData] }),
      };

      mockFetch.mockResolvedValue(mockResponse);

      const result = await getUserHandler(specialUid, validToken);

      expect(result.uid).toBe(specialUid);
    });
  });

  describe("API Request Format", () => {
    it("should send correct request headers and body format", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          users: [{ localId: validUid }],
        }),
      };

      mockFetch.mockResolvedValue(mockResponse);

      await getUserHandler(validUid, validToken);

      expect(mockFetch).toHaveBeenCalledWith("https://identitytoolkit.googleapis.com/v1/accounts:lookup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${validToken}`,
        },
        body: JSON.stringify({
          localId: [validUid], // Should be an array
        }),
      });
    });
  });
});
