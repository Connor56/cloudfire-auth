import { describe, it, expect, vi, beforeEach } from "vitest";
import { deleteUserHandler } from "../../src/rest-api/delete-user.js";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("deleteUserHandler", () => {
  const validUid = "test-user-123";
  const validOAuth2Token = "valid-oauth2-token";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Input Validation", () => {
    it("should reject empty uid", async () => {
      await expect(deleteUserHandler("", validOAuth2Token)).rejects.toThrow("uid must be a non-empty string");
    });

    it("should reject non-string uid", async () => {
      await expect(deleteUserHandler(123 as any, validOAuth2Token)).rejects.toThrow("uid must be a non-empty string");
    });

    it("should reject null uid", async () => {
      await expect(deleteUserHandler(null as any, validOAuth2Token)).rejects.toThrow("uid must be a non-empty string");
    });

    it("should reject undefined uid", async () => {
      await expect(deleteUserHandler(undefined as any, validOAuth2Token)).rejects.toThrow(
        "uid must be a non-empty string"
      );
    });

    it("should reject empty oauth2AccessToken", async () => {
      await expect(deleteUserHandler(validUid, "")).rejects.toThrow("oauth2AccessToken must be a non-empty string");
    });

    it("should reject non-string oauth2AccessToken", async () => {
      await expect(deleteUserHandler(validUid, 123 as any)).rejects.toThrow(
        "oauth2AccessToken must be a non-empty string"
      );
    });

    it("should reject null oauth2AccessToken", async () => {
      await expect(deleteUserHandler(validUid, null as any)).rejects.toThrow(
        "oauth2AccessToken must be a non-empty string"
      );
    });

    it("should reject undefined oauth2AccessToken", async () => {
      await expect(deleteUserHandler(validUid, undefined as any)).rejects.toThrow(
        "oauth2AccessToken must be a non-empty string"
      );
    });
  });

  describe("Successful Deletion", () => {
    beforeEach(() => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({}),
      };
      mockFetch.mockResolvedValue(mockResponse);
    });

    it("should successfully delete a user", async () => {
      await deleteUserHandler(validUid, validOAuth2Token);

      expect(mockFetch).toHaveBeenCalledOnce();
      expect(mockFetch).toHaveBeenCalledWith("https://identitytoolkit.googleapis.com/v1/accounts:delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${validOAuth2Token}`,
        },
        body: JSON.stringify({
          localId: validUid,
        }),
      });
    });

    it("should handle long user IDs", async () => {
      const longUid = "a".repeat(128);

      await deleteUserHandler(longUid, validOAuth2Token);

      expect(mockFetch).toHaveBeenCalledWith("https://identitytoolkit.googleapis.com/v1/accounts:delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${validOAuth2Token}`,
        },
        body: JSON.stringify({
          localId: longUid,
        }),
      });
    });

    it("should handle special characters in uid", async () => {
      const specialUid = "user-with-special_chars.123@domain";

      await deleteUserHandler(specialUid, validOAuth2Token);

      expect(mockFetch).toHaveBeenCalledWith("https://identitytoolkit.googleapis.com/v1/accounts:delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${validOAuth2Token}`,
        },
        body: JSON.stringify({
          localId: specialUid,
        }),
      });
    });

    it("should handle Unicode characters in uid", async () => {
      const unicodeUid = "用户-测试-123";

      await deleteUserHandler(unicodeUid, validOAuth2Token);

      expect(mockFetch).toHaveBeenCalledWith("https://identitytoolkit.googleapis.com/v1/accounts:delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${validOAuth2Token}`,
        },
        body: JSON.stringify({
          localId: unicodeUid,
        }),
      });
    });

    it("should return undefined on successful deletion", async () => {
      const result = await deleteUserHandler(validUid, validOAuth2Token);
      expect(result).toBeUndefined();
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

      await expect(deleteUserHandler(validUid, validOAuth2Token)).rejects.toThrow(
        'Failed to delete user: 400 Bad Request\n{\n  "error": {\n    "code": 400,\n    "message": "INVALID_ID_TOKEN",\n    "errors": [\n      {\n        "message": "INVALID_ID_TOKEN",\n        "domain": "global",\n        "reason": "invalid"\n      }\n    ]\n  }\n}'
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

      await expect(deleteUserHandler(validUid, validOAuth2Token)).rejects.toThrow(
        "Failed to delete user: 401 Unauthorized - Unauthorized access"
      );
    });

    it("should handle HTTP 403 errors (permission denied)", async () => {
      const mockResponse = {
        ok: false,
        status: 403,
        statusText: "Forbidden",
        text: vi.fn().mockResolvedValue(
          JSON.stringify({
            error: {
              code: 403,
              message: "PERMISSION_DENIED",
              details: "Insufficient permissions to delete users",
            },
          })
        ),
      };

      mockFetch.mockResolvedValue(mockResponse);

      await expect(deleteUserHandler(validUid, validOAuth2Token)).rejects.toThrow(
        "Failed to delete user: 403 Forbidden"
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

      await expect(deleteUserHandler(validUid, validOAuth2Token)).rejects.toThrow(
        'Failed to delete user: 404 Not Found\n{\n  "error": {\n    "message": "USER_NOT_FOUND"\n  }\n}'
      );
    });

    it("should handle HTTP 500 errors (internal server error)", async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        text: vi.fn().mockResolvedValue(
          JSON.stringify({
            error: {
              code: 500,
              message: "INTERNAL_ERROR",
              details: "An internal error has occurred",
            },
          })
        ),
      };

      mockFetch.mockResolvedValue(mockResponse);

      await expect(deleteUserHandler(validUid, validOAuth2Token)).rejects.toThrow(
        "Failed to delete user: 500 Internal Server Error"
      );
    });

    it("should handle malformed JSON error responses", async () => {
      const mockResponse = {
        ok: false,
        status: 400,
        statusText: "Bad Request",
        text: vi.fn().mockResolvedValue("Invalid JSON response"),
      };

      mockFetch.mockResolvedValue(mockResponse);

      await expect(deleteUserHandler(validUid, validOAuth2Token)).rejects.toThrow(
        "Failed to delete user: 400 Bad Request - Invalid JSON response"
      );
    });

    it("should handle network errors", async () => {
      const networkError = new Error("Network connection failed");
      mockFetch.mockRejectedValue(networkError);

      await expect(deleteUserHandler(validUid, validOAuth2Token)).rejects.toThrow("Network connection failed");
    });

    it("should handle timeout errors", async () => {
      const timeoutError = new Error("Request timeout");
      mockFetch.mockRejectedValue(timeoutError);

      await expect(deleteUserHandler(validUid, validOAuth2Token)).rejects.toThrow("Request timeout");
    });

    it("should handle DNS resolution errors", async () => {
      const dnsError = new Error("DNS resolution failed");
      mockFetch.mockRejectedValue(dnsError);

      await expect(deleteUserHandler(validUid, validOAuth2Token)).rejects.toThrow("DNS resolution failed");
    });
  });

  describe("Response Handling", () => {
    it("should handle successful response with empty body", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({}),
      };
      mockFetch.mockResolvedValue(mockResponse);

      await expect(deleteUserHandler(validUid, validOAuth2Token)).resolves.toBeUndefined();
    });

    it("should handle successful response with deletion data", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          kind: "identitytoolkit#DeleteAccountResponse",
        }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      await expect(deleteUserHandler(validUid, validOAuth2Token)).resolves.toBeUndefined();
    });

    it("should handle response parsing errors gracefully", async () => {
      const mockResponse = {
        ok: false,
        status: 400,
        statusText: "Bad Request",
        text: vi.fn().mockRejectedValue(new Error("Failed to read response")),
      };
      mockFetch.mockResolvedValue(mockResponse);

      await expect(deleteUserHandler(validUid, validOAuth2Token)).rejects.toThrow("Failed to read response");
    });

    it("should handle successful response even when JSON parsing fails", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockRejectedValue(new Error("JSON parse error")),
      };
      mockFetch.mockResolvedValue(mockResponse);

      // Should succeed even if JSON parsing fails, since the response was ok
      await expect(deleteUserHandler(validUid, validOAuth2Token)).resolves.toBeUndefined();
    });
  });

  describe("Authorization Header Formatting", () => {
    it("should format authorization header correctly", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({}),
      };
      mockFetch.mockResolvedValue(mockResponse);

      await deleteUserHandler(validUid, validOAuth2Token);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://identitytoolkit.googleapis.com/v1/accounts:delete",
        expect.objectContaining({
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${validOAuth2Token}`,
          },
        })
      );
    });

    it("should handle tokens with special characters", async () => {
      const specialToken = "token.with-special_characters123-ABC_def";
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({}),
      };
      mockFetch.mockResolvedValue(mockResponse);

      await deleteUserHandler(validUid, specialToken);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://identitytoolkit.googleapis.com/v1/accounts:delete",
        expect.objectContaining({
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${specialToken}`,
          },
        })
      );
    });

    it("should handle very long tokens", async () => {
      const longToken = "a".repeat(2000);
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({}),
      };
      mockFetch.mockResolvedValue(mockResponse);

      await deleteUserHandler(validUid, longToken);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://identitytoolkit.googleapis.com/v1/accounts:delete",
        expect.objectContaining({
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${longToken}`,
          },
        })
      );
    });
  });

  describe("Edge Cases", () => {
    it("should handle concurrent deletion requests", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({}),
      };
      mockFetch.mockResolvedValue(mockResponse);

      // Make concurrent deletion calls with different users
      const deletionPromises = [
        deleteUserHandler("user1", validOAuth2Token),
        deleteUserHandler("user2", validOAuth2Token),
        deleteUserHandler("user3", validOAuth2Token),
      ];

      const results = await Promise.all(deletionPromises);
      expect(results).toEqual([undefined, undefined, undefined]);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it("should handle rapid successive deletion calls", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({}),
      };
      mockFetch.mockResolvedValue(mockResponse);

      // Rapidly call delete multiple times for the same user
      const rapidDeletions = [];
      for (let i = 0; i < 5; i++) {
        rapidDeletions.push(deleteUserHandler(validUid, validOAuth2Token));
      }

      const results = await Promise.all(rapidDeletions);
      expect(results).toHaveLength(5);
      expect(results.every((result) => result === undefined)).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(5);
    });

    it("should handle empty response body", async () => {
      const mockResponse = {
        ok: true,
        text: vi.fn().mockResolvedValue(""),
        json: vi.fn().mockResolvedValue(null),
      };
      mockFetch.mockResolvedValue(mockResponse);

      await expect(deleteUserHandler(validUid, validOAuth2Token)).resolves.toBeUndefined();
    });

    it("should handle response with unexpected content-type", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ unexpected: "data" }),
        headers: new Map([["content-type", "text/html"]]),
      };
      mockFetch.mockResolvedValue(mockResponse);

      await expect(deleteUserHandler(validUid, validOAuth2Token)).resolves.toBeUndefined();
    });
  });

  describe("Request Body Validation", () => {
    it("should send correct request body structure", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({}),
      };
      mockFetch.mockResolvedValue(mockResponse);

      await deleteUserHandler(validUid, validOAuth2Token);

      const expectedBody = JSON.stringify({
        localId: validUid,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://identitytoolkit.googleapis.com/v1/accounts:delete",
        expect.objectContaining({
          method: "POST",
          body: expectedBody,
        })
      );
    });

    it("should handle UIDs with JSON-special characters", async () => {
      const specialUid = 'user"with\\quotes/and\nlines';
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({}),
      };
      mockFetch.mockResolvedValue(mockResponse);

      await deleteUserHandler(specialUid, validOAuth2Token);

      const parsedBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(parsedBody.localId).toBe(specialUid);
    });
  });

  describe("Error Message Formatting", () => {
    it("should format detailed Firebase API errors correctly", async () => {
      const firebaseError = {
        error: {
          code: 400,
          message: "INVALID_USER_ID",
          errors: [
            {
              message: "Invalid user ID format",
              domain: "firebase",
              reason: "invalidFormat",
            },
          ],
        },
      };

      const mockResponse = {
        ok: false,
        status: 400,
        statusText: "Bad Request",
        text: vi.fn().mockResolvedValue(JSON.stringify(firebaseError)),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const error = await deleteUserHandler(validUid, validOAuth2Token).catch((e) => e);
      expect(error.message).toContain("Failed to delete user: 400 Bad Request");
      expect(error.message).toContain("INVALID_USER_ID");
      expect(error.message).toContain("invalidFormat");
    });

    it("should handle non-JSON error responses", async () => {
      const mockResponse = {
        ok: false,
        status: 503,
        statusText: "Service Unavailable",
        text: vi.fn().mockResolvedValue("Service temporarily unavailable"),
      };
      mockFetch.mockResolvedValue(mockResponse);

      await expect(deleteUserHandler(validUid, validOAuth2Token)).rejects.toThrow(
        "Failed to delete user: 503 Service Unavailable - Service temporarily unavailable"
      );
    });
  });
});
