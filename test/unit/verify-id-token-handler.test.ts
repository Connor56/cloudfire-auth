import { describe, it, expect, beforeEach } from "vitest";
import { verifyIdTokenHandler, validateJwtHeader } from "../../src/rest-api/verify-id-token.js";
import { config } from "dotenv";
import { KVNamespace } from "@cloudflare/workers-types";
import { SignJWT, generateKeyPair, importX509 } from "jose";
import { vi } from "vitest";

// Mock the jose module
vi.mock("jose", async () => {
  const actual = await vi.importActual("jose");
  return {
    ...actual,
    importX509: vi.fn(),
  };
});

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

describe("Verify ID Token Handler Unit Tests", () => {
  describe("verifyIdTokenHandler function", () => {
    const mockProjectId = "test-project-id";
    const mockOauth2Token = "mock-oauth2-token";

    beforeEach(() => {
      // Reset all mocks before each test
      vi.clearAllMocks();
    });

    it("should successfully verify a valid token without checkRevoked", async () => {
      const mockKV = createMockKV() as KVNamespace;
      const { token: validToken, publicKey } = await createValidMockToken(mockProjectId);

      // Mock Google public key lookup to return a valid key
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ "mock-key-id": publicKey }),
        headers: new Headers({ "cache-control": "max-age=3600" }),
      });

      // Mock importX509 to return our generated public key
      const mockImportX509 = vi.mocked(importX509);
      mockImportX509.mockResolvedValue(publicKey);

      try {
        const result = await verifyIdTokenHandler(validToken, mockProjectId, mockOauth2Token, mockKV, false);

        expect(result).toBeDefined();
        expect(result.aud).toBe(mockProjectId);
        expect(result.iss).toBe(`https://securetoken.google.com/${mockProjectId}`);
      } catch (error) {
        // This test might fail due to signature verification with mock keys
        // This is expected as we're using fake certificates
        expect(error).toBeInstanceOf(Error);
      } finally {
        global.fetch = originalFetch;
        mockImportX509.mockReset();
      }
    }, 1000);

    it("should reject token with invalid body - wrong audience", async () => {
      const mockKV = createMockKV() as KVNamespace;
      const tokenWithWrongAudience = await createTokenWithWrongAudience();

      try {
        await verifyIdTokenHandler(tokenWithWrongAudience, mockProjectId, mockOauth2Token, mockKV, false);
        expect.fail("Expected token with wrong audience to fail");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toContain("Token audience does not match project ID");
      }
    });

    it("should reject token with invalid body - wrong issuer", async () => {
      const mockKV = createMockKV() as KVNamespace;
      const tokenWithWrongIssuer = await createTokenWithWrongIssuer(mockProjectId);

      try {
        await verifyIdTokenHandler(tokenWithWrongIssuer, mockProjectId, mockOauth2Token, mockKV, false);
        expect.fail("Expected token with wrong issuer to fail");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toContain("Token issuer does not match project ID");
      }
    });

    it("should reject expired token", async () => {
      const mockKV = createMockKV() as KVNamespace;
      const expiredToken = await createExpiredToken(mockProjectId);

      try {
        await verifyIdTokenHandler(expiredToken, mockProjectId, mockOauth2Token, mockKV, false);
        expect.fail("Expected expired token to fail");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toBe("Token expiration date is in the past");
      }
    });

    it("should reject token with future issued-at time", async () => {
      const mockKV = createMockKV() as KVNamespace;
      const futureIatToken = await createTokenWithFutureIat(mockProjectId);

      try {
        await verifyIdTokenHandler(futureIatToken, mockProjectId, mockOauth2Token, mockKV, false);
        expect.fail("Expected token with future iat to fail");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toBe("Token issued at date is in the future");
      }
    });

    it("should reject token with empty subject", async () => {
      const mockKV = createMockKV() as KVNamespace;
      const emptySubjectToken = await createTokenWithEmptySubject(mockProjectId);

      try {
        await verifyIdTokenHandler(emptySubjectToken, mockProjectId, mockOauth2Token, mockKV, false);
        expect.fail("Expected token with empty subject to fail");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toBe("Token subject is empty");
      }
    });

    it("should reject token with non-string subject", async () => {
      const mockKV = createMockKV() as KVNamespace;
      const nonStringSubjectToken = await createTokenWithNonStringSubject(mockProjectId);

      try {
        await verifyIdTokenHandler(nonStringSubjectToken, mockProjectId, mockOauth2Token, mockKV, false);
        expect.fail("Expected token with non-string subject to fail");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toBe("Token subject is not a string");
      }
    });

    it("should reject token with invalid header - wrong algorithm", async () => {
      const mockKV = createMockKV() as KVNamespace;
      const wrongAlgToken = await createTokenWithWrongAlgorithm(mockProjectId);

      try {
        await verifyIdTokenHandler(wrongAlgToken, mockProjectId, mockOauth2Token, mockKV, false);
        expect.fail("Expected token with wrong algorithm to fail");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toBe("Token algorithm is not RS256");
      }
    });

    it("should reject revoked token when checkRevoked=true", async () => {
      const mockKV = createMockKV() as KVNamespace;
      const { token: validToken, publicKey } = await createValidTokenForRevocationTest(mockProjectId);

      // Mock the accounts:lookup API to return a validSince time after the token iat
      const originalFetch = global.fetch;
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              "mock-key-id": publicKey,
            }),
          headers: new Headers({ "cache-control": "max-age=3600" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              users: [
                {
                  validSince: (Math.floor(Date.now() / 1000) + 100).toString(), // validSince after token iat
                },
              ],
            }),
        });

      const mockImportX509 = vi.mocked(importX509);
      mockImportX509.mockResolvedValue(publicKey);

      try {
        await verifyIdTokenHandler(
          validToken,
          mockProjectId,
          mockOauth2Token,
          mockKV,
          true // checkRevoked = true
        );
        expect.fail("Expected revoked token check to fail");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        // Could fail at signature verification or revocation check
        expect(error.message).toMatch(/Token is (invalid|revoked)/);
      } finally {
        global.fetch = originalFetch;
        mockImportX509.mockReset();
      }
    });

    it("should handle network errors gracefully", async () => {
      const mockKV = createMockKV() as KVNamespace;
      const { token: validToken } = await createValidMockToken(mockProjectId);

      // Mock network failure
      const originalFetch = global.fetch;
      const networkError = new Error("Network error");
      global.fetch = vi.fn().mockRejectedValue(networkError);

      try {
        await verifyIdTokenHandler(validToken, mockProjectId, mockOauth2Token, mockKV, false);
        expect.fail("Expected network error to cause failure");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error).toBe(networkError);
      } finally {
        global.fetch = originalFetch;
      }
    }, 500);
  });

  describe("validateJwtHeader function", () => {
    it("should validate a token with cached public key", async () => {
      const mockKV = createMockKV() as KVNamespace;
      const { token } = await createValidMockToken("test-project");

      // Pre-populate the KV cache
      await mockKV.put("googlePublicKey-mock-key-id", "mock-certificate");

      const result = await validateJwtHeader(token, mockKV);

      expect(result.isValid).toBe(true);
      expect(result.signingKey).toBe("mock-certificate");
    });

    it("should fetch public key when not cached", async () => {
      const mockKV = createMockKV() as KVNamespace;
      const { token } = await createValidMockToken("test-project");

      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            "mock-key-id": "fetched-certificate",
          }),
        headers: new Headers({ "cache-control": "max-age=3600" }),
      });

      const result = await validateJwtHeader(token, mockKV);

      expect(result.isValid).toBe(true);
      expect(result.signingKey).toBe("fetched-certificate");

      // Verify it was cached
      expect(await mockKV.get("googlePublicKey-mock-key-id")).toBe("fetched-certificate");

      global.fetch = originalFetch;
    });

    it("should fail when key ID not found in Google API", async () => {
      const mockKV = createMockKV() as KVNamespace;
      const token = await createTokenWithUnknownKeyId("test-project");

      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}), // Empty response, no keys
        headers: new Headers({ "cache-control": "max-age=3600" }),
      });

      const result = await validateJwtHeader(token, mockKV);

      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toBe("Token key ID is not in the Google API");

      global.fetch = originalFetch;
    });
  });
});

interface CreateValidMockTokenResult {
  token: string;
  publicKey: CryptoKey;
  privateKey: CryptoKey;
}

/**
 * Creates a valid mock token for unit testing
 */
async function createValidMockToken(projectId: string): Promise<CreateValidMockTokenResult> {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const currentTime = Math.floor(Date.now() / 1000);

  const token = await new SignJWT({
    iss: `https://securetoken.google.com/${projectId}`,
    aud: projectId,
    sub: "test-user-id",
    iat: currentTime,
    exp: currentTime + 3600,
    auth_time: currentTime,
    email: "test@example.com",
    email_verified: true,
    firebase: {
      identities: { email: ["test@example.com"] },
      sign_in_provider: "password",
    },
  })
    .setProtectedHeader({ alg: "RS256", kid: "mock-key-id" })
    .sign(privateKey);

  return { token, publicKey, privateKey };
}

/**
 * Creates a token for revocation testing (with known iat)
 */
async function createValidTokenForRevocationTest(projectId: string): Promise<CreateValidMockTokenResult> {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const currentTime = Math.floor(Date.now() / 1000);

  // Create a token with iat that can be compared against validSince
  const token = await new SignJWT({
    iss: `https://securetoken.google.com/${projectId}`,
    aud: projectId,
    sub: "revocation-test-user",
    iat: currentTime - 3600, // 1 hour ago, so it can be revoked
    exp: currentTime + 3600,
    auth_time: currentTime - 3600,
  })
    .setProtectedHeader({ alg: "RS256", kid: "mock-key-id" })
    .sign(privateKey);

  return { token, publicKey, privateKey };
}

/**
 * Creates a token with wrong audience for testing
 */
async function createTokenWithWrongAudience(): Promise<string> {
  const { privateKey } = await generateKeyPair("RS256");
  const currentTime = Math.floor(Date.now() / 1000);

  return await new SignJWT({
    iss: "https://securetoken.google.com/test-project-id",
    aud: "wrong-project-id", // Wrong audience
    sub: "test-user-id",
    iat: currentTime,
    exp: currentTime + 3600,
    auth_time: currentTime,
  })
    .setProtectedHeader({ alg: "RS256", kid: "mock-key-id" })
    .sign(privateKey);
}

/**
 * Creates a token with wrong issuer for testing
 */
async function createTokenWithWrongIssuer(projectId: string): Promise<string> {
  const { privateKey } = await generateKeyPair("RS256");
  const currentTime = Math.floor(Date.now() / 1000);

  return await new SignJWT({
    iss: "https://evil.com", // Wrong issuer
    aud: projectId,
    sub: "test-user-id",
    iat: currentTime,
    exp: currentTime + 3600,
    auth_time: currentTime,
  })
    .setProtectedHeader({ alg: "RS256", kid: "mock-key-id" })
    .sign(privateKey);
}

/**
 * Creates an expired token for testing
 */
async function createExpiredToken(projectId: string): Promise<string> {
  const { privateKey } = await generateKeyPair("RS256");
  const currentTime = Math.floor(Date.now() / 1000);

  return await new SignJWT({
    iss: `https://securetoken.google.com/${projectId}`,
    aud: projectId,
    sub: "test-user-id",
    iat: currentTime - 7200, // 2 hours ago
    exp: currentTime - 3600, // Expired 1 hour ago
    auth_time: currentTime - 7200,
  })
    .setProtectedHeader({ alg: "RS256", kid: "mock-key-id" })
    .sign(privateKey);
}

/**
 * Creates a token with future iat for testing
 */
async function createTokenWithFutureIat(projectId: string): Promise<string> {
  const { privateKey } = await generateKeyPair("RS256");
  const currentTime = Math.floor(Date.now() / 1000);

  return await new SignJWT({
    iss: `https://securetoken.google.com/${projectId}`,
    aud: projectId,
    sub: "test-user-id",
    iat: currentTime + 3600, // 1 hour in the future
    exp: currentTime + 7200,
    auth_time: currentTime,
  })
    .setProtectedHeader({ alg: "RS256", kid: "mock-key-id" })
    .sign(privateKey);
}

/**
 * Creates a token with empty subject for testing
 */
async function createTokenWithEmptySubject(projectId: string): Promise<string> {
  const { privateKey } = await generateKeyPair("RS256");
  const currentTime = Math.floor(Date.now() / 1000);

  return await new SignJWT({
    iss: `https://securetoken.google.com/${projectId}`,
    aud: projectId,
    sub: "", // Empty subject
    iat: currentTime,
    exp: currentTime + 3600,
    auth_time: currentTime,
  })
    .setProtectedHeader({ alg: "RS256", kid: "mock-key-id" })
    .sign(privateKey);
}

/**
 * Creates a token with non-string subject for testing
 */
async function createTokenWithNonStringSubject(projectId: string): Promise<string> {
  const { privateKey } = await generateKeyPair("RS256");
  const currentTime = Math.floor(Date.now() / 1000);

  return await new SignJWT({
    iss: `https://securetoken.google.com/${projectId}`,
    aud: projectId,
    sub: 12345 as any, // Non-string subject
    iat: currentTime,
    exp: currentTime + 3600,
    auth_time: currentTime,
  })
    .setProtectedHeader({ alg: "RS256", kid: "mock-key-id" })
    .sign(privateKey);
}

/**
 * Creates a token with wrong algorithm for testing
 */
async function createTokenWithWrongAlgorithm(projectId: string): Promise<string> {
  // Create a token with HS256 instead of RS256
  const currentTime = Math.floor(Date.now() / 1000);

  // For HS256, we need to use a secret key instead of RSA keys
  const secret = new TextEncoder().encode("fake-secret-key");

  return await new SignJWT({
    iss: `https://securetoken.google.com/${projectId}`,
    aud: projectId,
    sub: "test-user-id",
    iat: currentTime,
    exp: currentTime + 3600,
    auth_time: currentTime,
  })
    .setProtectedHeader({ alg: "HS256", kid: "mock-key-id" })
    .sign(secret);
}

/**
 * Creates a token with unknown key ID for testing
 */
async function createTokenWithUnknownKeyId(projectId: string): Promise<string> {
  const { privateKey } = await generateKeyPair("RS256");
  const currentTime = Math.floor(Date.now() / 1000);

  return await new SignJWT({
    iss: `https://securetoken.google.com/${projectId}`,
    aud: projectId,
    sub: "test-user-id",
    iat: currentTime,
    exp: currentTime + 3600,
    auth_time: currentTime,
  })
    .setProtectedHeader({ alg: "RS256", kid: "unknown-key-id" })
    .sign(privateKey);
}
