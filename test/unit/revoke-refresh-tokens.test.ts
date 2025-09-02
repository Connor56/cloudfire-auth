import { describe, it, expect, vi, beforeEach } from "vitest";
import { revokeRefreshTokensHandler } from "../../src/rest-api/revoke-refresh-tokens.js";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("revokeRefreshTokensHandler", () => {
  const validUid = "test-user-123";
  const validOAuth2Token = "valid-oauth2-token";

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock Date.now to return a consistent timestamp
    vi.spyOn(Date, "now").mockReturnValue(1640995200000); // 2022-01-01 00:00:00 UTC
  });

  describe("Input Validation", () => {
    it("should reject empty uid", async () => {
      await expect(revokeRefreshTokensHandler("", validOAuth2Token)).rejects.toThrow("uid must be a non-empty string");
    });

    it("should reject non-string uid", async () => {
      await expect(revokeRefreshTokensHandler(123 as any, validOAuth2Token)).rejects.toThrow(
        "uid must be a non-empty string"
      );
    });

    it("should reject null uid", async () => {
      await expect(revokeRefreshTokensHandler(null as any, validOAuth2Token)).rejects.toThrow(
        "uid must be a non-empty string"
      );
    });

    it("should reject undefined uid", async () => {
      await expect(revokeRefreshTokensHandler(undefined as any, validOAuth2Token)).rejects.toThrow(
        "uid must be a non-empty string"
      );
    });

    it("should reject empty oauth2AccessToken", async () => {
      await expect(revokeRefreshTokensHandler(validUid, "")).rejects.toThrow(
        "oauth2AccessToken must be a non-empty string"
      );
    });

    it("should reject non-string oauth2AccessToken", async () => {
      await expect(revokeRefreshTokensHandler(validUid, 123 as any)).rejects.toThrow(
        "oauth2AccessToken must be a non-empty string"
      );
    });

    it("should reject null oauth2AccessToken", async () => {
      await expect(revokeRefreshTokensHandler(validUid, null as any)).rejects.toThrow(
        "oauth2AccessToken must be a non-empty string"
      );
    });

    it("should reject undefined oauth2AccessToken", async () => {
      await expect(revokeRefreshTokensHandler(validUid, undefined as any)).rejects.toThrow(
        "oauth2AccessToken must be a non-empty string"
      );
    });
  });

  describe("Successful Revocation", () => {
    beforeEach(() => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({}),
      };
      mockFetch.mockResolvedValue(mockResponse);
    });

    it("should successfully revoke refresh tokens", async () => {
      await revokeRefreshTokensHandler(validUid, validOAuth2Token);

      expect(mockFetch).toHaveBeenCalledOnce();
      expect(mockFetch).toHaveBeenCalledWith("https://identitytoolkit.googleapis.com/v1/accounts:update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${validOAuth2Token}`,
        },
        body: JSON.stringify({
          localId: validUid,
          validSince: "1640995200", // Math.floor(1640995200000 / 1000)
        }),
      });
    });

    it("should use current timestamp for validSince", async () => {
      const specificTimestamp = 1672531200000; // 2023-01-01 00:00:00 UTC
      vi.spyOn(Date, "now").mockReturnValue(specificTimestamp);

      await revokeRefreshTokensHandler(validUid, validOAuth2Token);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://identitytoolkit.googleapis.com/v1/accounts:update",
        expect.objectContaining({
          body: JSON.stringify({
            localId: validUid,
            validSince: "1672531200", // Math.floor(specificTimestamp / 1000)
          }),
        })
      );
    });

    it("should handle long uids", async () => {
      const longUid = "a".repeat(128);

      await revokeRefreshTokensHandler(longUid, validOAuth2Token);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://identitytoolkit.googleapis.com/v1/accounts:update",
        expect.objectContaining({
          body: JSON.stringify({
            localId: longUid,
            validSince: "1640995200",
          }),
        })
      );
    });

    it("should handle special characters in uid", async () => {
      const specialUid = "user-with-special_chars.123";

      await revokeRefreshTokensHandler(specialUid, validOAuth2Token);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://identitytoolkit.googleapis.com/v1/accounts:update",
        expect.objectContaining({
          body: JSON.stringify({
            localId: specialUid,
            validSince: "1640995200",
          }),
        })
      );
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

      await expect(revokeRefreshTokensHandler(validUid, validOAuth2Token)).rejects.toThrow(
        'Failed to revoke refresh tokens: 400 Bad Request\n{\n  "error": {\n    "code": 400,\n    "message": "INVALID_ID_TOKEN",\n    "errors": [\n      {\n        "message": "INVALID_ID_TOKEN",\n        "domain": "global",\n        "reason": "invalid"\n      }\n    ]\n  }\n}'
      );
    });

    it("should handle HTTP 401 errors (unauthorized)", async () => {
      const mockResponse = {
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        text: vi.fn().mockResolvedValue("Unauthorized access"),
      };

      mockFetch.mockResolvedValue(mockResponse);

      await expect(revokeRefreshTokensHandler(validUid, validOAuth2Token)).rejects.toThrow(
        "Failed to revoke refresh tokens: 401 Unauthorized - Unauthorized access"
      );
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

      await expect(revokeRefreshTokensHandler(validUid, validOAuth2Token)).rejects.toThrow(
        'Failed to revoke refresh tokens: 404 Not Found\n{\n  "error": {\n    "message": "USER_NOT_FOUND"\n  }\n}'
      );
    });

    it("should handle HTTP 403 errors (forbidden)", async () => {
      const mockResponse = {
        ok: false,
        status: 403,
        statusText: "Forbidden",
        text: vi.fn().mockResolvedValue(
          JSON.stringify({
            error: {
              code: 403,
              message: "PERMISSION_DENIED",
              details: "Insufficient permissions to revoke tokens",
            },
          })
        ),
      };

      mockFetch.mockResolvedValue(mockResponse);

      await expect(revokeRefreshTokensHandler(validUid, validOAuth2Token)).rejects.toThrow(
        "Failed to revoke refresh tokens: 403 Forbidden"
      );
    });

    it("should handle malformed JSON error responses", async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        text: vi.fn().mockResolvedValue("Invalid JSON response"),
      };

      mockFetch.mockResolvedValue(mockResponse);

      await expect(revokeRefreshTokensHandler(validUid, validOAuth2Token)).rejects.toThrow(
        "Failed to revoke refresh tokens: 500 Internal Server Error - Invalid JSON response"
      );
    });

    it("should handle network errors", async () => {
      const networkError = new Error("Network connection failed");
      mockFetch.mockRejectedValue(networkError);

      await expect(revokeRefreshTokensHandler(validUid, validOAuth2Token)).rejects.toThrow("Network connection failed");
    });

    it("should handle timeout errors", async () => {
      const timeoutError = new Error("Request timeout");
      mockFetch.mockRejectedValue(timeoutError);

      await expect(revokeRefreshTokensHandler(validUid, validOAuth2Token)).rejects.toThrow("Request timeout");
    });
  });

  describe("Edge Cases", () => {
    it("should handle very large timestamp values", async () => {
      const largeTimestamp = 9999999999999; // Year 2286
      vi.spyOn(Date, "now").mockReturnValue(largeTimestamp);

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({}),
      };
      mockFetch.mockResolvedValue(mockResponse);

      await revokeRefreshTokensHandler(validUid, validOAuth2Token);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://identitytoolkit.googleapis.com/v1/accounts:update",
        expect.objectContaining({
          body: JSON.stringify({
            localId: validUid,
            validSince: Math.floor(largeTimestamp / 1000).toString(),
          }),
        })
      );
    });

    it("should handle minimum timestamp values", async () => {
      const minTimestamp = 0;
      vi.spyOn(Date, "now").mockReturnValue(minTimestamp);

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({}),
      };
      mockFetch.mockResolvedValue(mockResponse);

      await revokeRefreshTokensHandler(validUid, validOAuth2Token);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://identitytoolkit.googleapis.com/v1/accounts:update",
        expect.objectContaining({
          body: JSON.stringify({
            localId: validUid,
            validSince: "0",
          }),
        })
      );
    });

    it("should handle concurrent calls with different timestamps", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({}),
      };
      mockFetch.mockResolvedValue(mockResponse);

      // First call
      vi.spyOn(Date, "now").mockReturnValueOnce(1000000);
      const firstCall = revokeRefreshTokensHandler(validUid, validOAuth2Token);

      // Second call with different timestamp
      vi.spyOn(Date, "now").mockReturnValueOnce(2000000);
      const secondCall = revokeRefreshTokensHandler("different-uid", validOAuth2Token);

      await Promise.all([firstCall, secondCall]);

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenNthCalledWith(
        1,
        "https://identitytoolkit.googleapis.com/v1/accounts:update",
        expect.objectContaining({
          body: JSON.stringify({
            localId: validUid,
            validSince: "1000", // Math.floor(1000000 / 1000)
          }),
        })
      );
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        "https://identitytoolkit.googleapis.com/v1/accounts:update",
        expect.objectContaining({
          body: JSON.stringify({
            localId: "different-uid",
            validSince: "2000", // Math.floor(2000000 / 1000)
          }),
        })
      );
    });
  });

  describe("Response Handling", () => {
    it("should handle successful response with empty body", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({}),
      };
      mockFetch.mockResolvedValue(mockResponse);

      await expect(revokeRefreshTokensHandler(validUid, validOAuth2Token)).resolves.toBeUndefined();
    });

    it("should handle successful response with user data", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          localId: validUid,
          email: "test@example.com",
          validSince: "1640995200",
        }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      await expect(revokeRefreshTokensHandler(validUid, validOAuth2Token)).resolves.toBeUndefined();
    });

    it("should handle response parsing errors gracefully", async () => {
      const mockResponse = {
        ok: false,
        status: 400,
        statusText: "Bad Request",
        text: vi.fn().mockRejectedValue(new Error("Failed to read response")),
      };
      mockFetch.mockResolvedValue(mockResponse);

      await expect(revokeRefreshTokensHandler(validUid, validOAuth2Token)).rejects.toThrow("Failed to read response");
    });
  });

  describe("Authorization Header Formatting", () => {
    it("should format authorization header correctly", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({}),
      };
      mockFetch.mockResolvedValue(mockResponse);

      await revokeRefreshTokensHandler(validUid, validOAuth2Token);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://identitytoolkit.googleapis.com/v1/accounts:update",
        expect.objectContaining({
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${validOAuth2Token}`,
          },
        })
      );
    });

    it("should handle tokens with special characters", async () => {
      const specialToken = "token.with-special_characters123";
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({}),
      };
      mockFetch.mockResolvedValue(mockResponse);

      await revokeRefreshTokensHandler(validUid, specialToken);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://identitytoolkit.googleapis.com/v1/accounts:update",
        expect.objectContaining({
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${specialToken}`,
          },
        })
      );
    });
  });
});
