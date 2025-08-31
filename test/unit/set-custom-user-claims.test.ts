import { describe, it, expect } from "vitest";
import { checkClaimsAreValid } from "../../src/rest-api/set-custom-user-claims.js";

describe("checkClaimsAreValid", () => {
  describe("Valid cases", () => {
    it("should accept null claims (to clear existing claims)", () => {
      expect(checkClaimsAreValid(null)).toBe(true);
    });

    it("should accept undefined claims", () => {
      expect(checkClaimsAreValid(undefined as any)).toBe(true);
    });

    it("should accept empty object", () => {
      expect(checkClaimsAreValid({})).toBe(true);
    });

    it("should accept valid custom claims", () => {
      const validClaims = {
        role: "admin",
        permissions: ["read", "write", "delete"],
        department: "engineering",
        level: 5,
        isActive: true,
      };
      expect(checkClaimsAreValid(validClaims)).toBe(true);
    });

    it("should accept nested objects in claims", () => {
      const validClaims = {
        metadata: {
          createdBy: "admin",
          createdAt: "2024-01-01",
        },
        preferences: {
          theme: "dark",
          notifications: true,
        },
      };
      expect(checkClaimsAreValid(validClaims)).toBe(true);
    });

    it("should accept arrays in claims", () => {
      const validClaims = {
        roles: ["user", "moderator"],
        tags: ["premium", "early-adopter"],
      };
      expect(checkClaimsAreValid(validClaims)).toBe(true);
    });

    it("should accept claims with different data types", () => {
      const validClaims = {
        stringField: "value",
        numberField: 42,
        booleanField: true,
        nullField: null,
        arrayField: [1, 2, 3],
        objectField: { nested: "value" },
      };
      expect(checkClaimsAreValid(validClaims)).toBe(true);
    });
  });

  describe("Invalid input types", () => {
    it("should reject arrays", () => {
      expect(checkClaimsAreValid([] as any)).toBe(false);
      expect(checkClaimsAreValid([1, 2, 3] as any)).toBe(false);
    });

    it("should reject primitive values", () => {
      expect(checkClaimsAreValid("string" as any)).toBe(false);
      expect(checkClaimsAreValid(123 as any)).toBe(false);
      expect(checkClaimsAreValid(true as any)).toBe(false);
    });
  });

  describe("Reserved Firebase Auth claims", () => {
    it("should throw error for 'iss' claim", () => {
      expect(() => checkClaimsAreValid({ iss: "https://securetoken.google.com/project" })).toThrow(
        "Reserved claim name: iss is not allowed in custom user claims"
      );
    });

    it("should throw error for 'aud' claim", () => {
      expect(() => checkClaimsAreValid({ aud: "project-id" })).toThrow(
        "Reserved claim name: aud is not allowed in custom user claims"
      );
    });

    it("should throw error for 'auth_time' claim", () => {
      expect(() => checkClaimsAreValid({ auth_time: 1640995200 })).toThrow(
        "Reserved claim name: auth_time is not allowed in custom user claims"
      );
    });

    it("should throw error for 'user_id' claim", () => {
      expect(() => checkClaimsAreValid({ user_id: "abc123" })).toThrow(
        "Reserved claim name: user_id is not allowed in custom user claims"
      );
    });

    it("should throw error for 'firebase' claim", () => {
      expect(() => checkClaimsAreValid({ firebase: { tenant: "tenant-id" } })).toThrow(
        "Reserved claim name: firebase is not allowed in custom user claims"
      );
    });

    it("should throw error for 'iat' claim", () => {
      expect(() => checkClaimsAreValid({ iat: 1640995200 })).toThrow(
        "Reserved claim name: iat is not allowed in custom user claims"
      );
    });

    it("should throw error for 'exp' claim", () => {
      expect(() => checkClaimsAreValid({ exp: 1640998800 })).toThrow(
        "Reserved claim name: exp is not allowed in custom user claims"
      );
    });

    it("should throw error for 'sub' claim", () => {
      expect(() => checkClaimsAreValid({ sub: "user-123" })).toThrow(
        "Reserved claim name: sub is not allowed in custom user claims"
      );
    });

    it("should throw error for 'uid' claim", () => {
      expect(() => checkClaimsAreValid({ uid: "user-123" })).toThrow(
        "Reserved claim name: uid is not allowed in custom user claims"
      );
    });
  });

  describe("Reserved OIDC claims", () => {
    it("should throw error for email-related claims", () => {
      expect(() => checkClaimsAreValid({ email: "user@example.com" })).toThrow(
        "Reserved claim name: email is not allowed in custom user claims"
      );
      expect(() => checkClaimsAreValid({ email_verified: true })).toThrow(
        "Reserved claim name: email_verified is not allowed in custom user claims"
      );
    });

    it("should throw error for phone-related claims", () => {
      expect(() => checkClaimsAreValid({ phone_number: "+1234567890" })).toThrow(
        "Reserved claim name: phone_number is not allowed in custom user claims"
      );
      expect(() => checkClaimsAreValid({ phone_number_verified: true })).toThrow(
        "Reserved claim name: phone_number_verified is not allowed in custom user claims"
      );
    });

    it("should throw error for name-related claims", () => {
      expect(() => checkClaimsAreValid({ name: "John Doe" })).toThrow(
        "Reserved claim name: name is not allowed in custom user claims"
      );
      expect(() => checkClaimsAreValid({ given_name: "John" })).toThrow(
        "Reserved claim name: given_name is not allowed in custom user claims"
      );
      expect(() => checkClaimsAreValid({ family_name: "Doe" })).toThrow(
        "Reserved claim name: family_name is not allowed in custom user claims"
      );
      expect(() => checkClaimsAreValid({ middle_name: "William" })).toThrow(
        "Reserved claim name: middle_name is not allowed in custom user claims"
      );
      expect(() => checkClaimsAreValid({ nickname: "Johnny" })).toThrow(
        "Reserved claim name: nickname is not allowed in custom user claims"
      );
      expect(() => checkClaimsAreValid({ preferred_username: "johndoe" })).toThrow(
        "Reserved claim name: preferred_username is not allowed in custom user claims"
      );
    });

    it("should throw error for profile-related claims", () => {
      expect(() => checkClaimsAreValid({ profile: "https://example.com/profile" })).toThrow(
        "Reserved claim name: profile is not allowed in custom user claims"
      );
      expect(() => checkClaimsAreValid({ picture: "https://example.com/avatar.jpg" })).toThrow(
        "Reserved claim name: picture is not allowed in custom user claims"
      );
      expect(() => checkClaimsAreValid({ website: "https://johndoe.com" })).toThrow(
        "Reserved claim name: website is not allowed in custom user claims"
      );
    });

    it("should throw error for personal information claims", () => {
      expect(() => checkClaimsAreValid({ gender: "male" })).toThrow(
        "Reserved claim name: gender is not allowed in custom user claims"
      );
      expect(() => checkClaimsAreValid({ birthdate: "1990-01-01" })).toThrow(
        "Reserved claim name: birthdate is not allowed in custom user claims"
      );
      expect(() => checkClaimsAreValid({ zoneinfo: "America/New_York" })).toThrow(
        "Reserved claim name: zoneinfo is not allowed in custom user claims"
      );
      expect(() => checkClaimsAreValid({ locale: "en-US" })).toThrow(
        "Reserved claim name: locale is not allowed in custom user claims"
      );
      expect(() => checkClaimsAreValid({ updated_at: 1640995200 })).toThrow(
        "Reserved claim name: updated_at is not allowed in custom user claims"
      );
    });

    it("should throw error for OAuth-related claims", () => {
      expect(() => checkClaimsAreValid({ azp: "client-id" })).toThrow(
        "Reserved claim name: azp is not allowed in custom user claims"
      );
      expect(() => checkClaimsAreValid({ nonce: "random-nonce" })).toThrow(
        "Reserved claim name: nonce is not allowed in custom user claims"
      );
      expect(() => checkClaimsAreValid({ at_hash: "hash-value" })).toThrow(
        "Reserved claim name: at_hash is not allowed in custom user claims"
      );
      expect(() => checkClaimsAreValid({ c_hash: "code-hash" })).toThrow(
        "Reserved claim name: c_hash is not allowed in custom user claims"
      );
    });
  });

  describe("Mixed valid and invalid claims", () => {
    it("should throw error if any claim is reserved (Firebase)", () => {
      const claims = {
        role: "admin", // Valid
        department: "engineering", // Valid
        firebase: { tenant: "abc" }, // Invalid - reserved
      };
      expect(() => checkClaimsAreValid(claims)).toThrow(
        "Reserved claim name: firebase is not allowed in custom user claims"
      );
    });

    it("should throw error if any claim is reserved (OIDC)", () => {
      const claims = {
        role: "admin", // Valid
        permissions: ["read", "write"], // Valid
        email: "user@example.com", // Invalid - reserved
      };
      expect(() => checkClaimsAreValid(claims)).toThrow(
        "Reserved claim name: email is not allowed in custom user claims"
      );
    });
  });

  describe("Size limit validation", () => {
    it("should accept claims under 1000 bytes", () => {
      // Create claims that are well under the limit
      const validClaims = {
        role: "admin",
        description: "A".repeat(100), // 100 chars
      };
      expect(checkClaimsAreValid(validClaims)).toBe(true);
    });

    it("should throw error for claims over 1000 bytes", () => {
      // Create claims that exceed the 1000-byte limit
      const largeClaims = {
        data: "x".repeat(1000), // 950 chars + JSON overhead > 1000 bytes
      };
      expect(() => checkClaimsAreValid(largeClaims)).toThrow(/Custom user claims are too large/);
    });

    it("should handle claims at the byte limit boundary", () => {
      // Create claims that are right at the boundary
      // JSON.stringify({"data": "xxx"}) = {"data":"xxx"} (13 chars + data length)
      const boundaryData = "x".repeat(1000 - 13); // Should be exactly at limit
      const boundaryClaims = {
        data: boundaryData,
      };

      // This should be very close to or at 1000 bytes
      const serialized = JSON.stringify(boundaryClaims);
      const size = new TextEncoder().encode(serialized).length;

      if (size > 1000) {
        expect(() => checkClaimsAreValid(boundaryClaims)).toThrow(/Custom user claims are too large/);
      } else {
        expect(checkClaimsAreValid(boundaryClaims)).toBe(true);
      }
    });

    it("should throw error for Unicode characters exceeding size limit", () => {
      // Unicode characters can be multiple bytes
      const unicodeClaims = {
        message: "🔥".repeat(500), // Each emoji is 4 bytes in UTF-8
      };
      expect(() => checkClaimsAreValid(unicodeClaims)).toThrow(/Custom user claims are too large/);
    });

    it("should throw error for nested objects exceeding size limit", () => {
      const nestedClaims = {
        level1: {
          level2: {
            level3: {
              data: "x".repeat(990),
            },
          },
        },
      };
      expect(() => checkClaimsAreValid(nestedClaims)).toThrow(/Custom user claims are too large/);
    });
  });

  describe("JSON serialization edge cases", () => {
    it("should throw error for circular references", () => {
      const circularClaims: any = {
        role: "admin",
      };
      circularClaims.self = circularClaims; // Creates circular reference

      expect(() => checkClaimsAreValid(circularClaims)).toThrow(/Failed to serialize custom user claims/);
    });

    it("should handle undefined values in objects", () => {
      const claimsWithUndefined = {
        role: "admin",
        undefinedField: undefined, // This gets omitted in JSON.stringify
      };
      expect(checkClaimsAreValid(claimsWithUndefined)).toBe(true);
    });

    it("should handle functions in objects", () => {
      const claimsWithFunction = {
        role: "admin",
        someFunction: function () {
          return "test";
        }, // Functions get omitted
      };
      expect(checkClaimsAreValid(claimsWithFunction)).toBe(true);
    });

    it("should handle symbols in objects", () => {
      const claimsWithSymbol = {
        role: "admin",
        [Symbol("test")]: "value", // Symbols get omitted
      };
      expect(checkClaimsAreValid(claimsWithSymbol)).toBe(true);
    });
  });

  describe("Real-world scenarios", () => {
    it("should accept typical user role claims", () => {
      const userClaims = {
        role: "user",
        plan: "premium",
        features: ["analytics", "export", "api"],
      };
      expect(checkClaimsAreValid(userClaims)).toBe(true);
    });

    it("should accept admin claims", () => {
      const adminClaims = {
        role: "admin",
        permissions: ["users:read", "users:write", "users:delete", "settings:write"],
        department: "IT",
        level: 10,
      };
      expect(checkClaimsAreValid(adminClaims)).toBe(true);
    });

    it("should accept organization claims", () => {
      const orgClaims = {
        organization: "acme-corp",
        organizationId: "org-123",
        roles: ["member", "billing-admin"],
        subscription: {
          plan: "enterprise",
          expires: "2024-12-31",
        },
      };
      expect(checkClaimsAreValid(orgClaims)).toBe(true);
    });

    it("should throw error for claims trying to impersonate system fields", () => {
      const maliciousClaims = {
        role: "user", // Valid
        iss: "https://evil.com", // Invalid - trying to override issuer
      };
      expect(() => checkClaimsAreValid(maliciousClaims)).toThrow(
        "Reserved claim name: iss is not allowed in custom user claims"
      );
    });
  });

  describe("Error message verification", () => {
    it("should provide specific error messages for different validation failures", () => {
      // Test reserved claim error message
      expect(() => checkClaimsAreValid({ email: "test@example.com" })).toThrow(
        "Reserved claim name: email is not allowed in custom user claims"
      );

      // Test size limit error message
      const largeClaims = { data: "x".repeat(1000) };
      expect(() => checkClaimsAreValid(largeClaims)).toThrow(
        /Custom user claims are too large\. Must be less than 1000 bytes\. Size: \d+ bytes/
      );

      // Test circular reference error message
      const circularClaims: any = { role: "admin" };
      circularClaims.self = circularClaims;
      expect(() => checkClaimsAreValid(circularClaims)).toThrow(/Failed to serialize custom user claims:/);
    });
  });

  describe("Edge cases", () => {
    it("should handle empty string keys", () => {
      const claimsWithEmptyKey = {
        "": "value", // Empty string key
        role: "admin",
      };
      expect(checkClaimsAreValid(claimsWithEmptyKey)).toBe(true);
    });

    it("should handle numeric keys", () => {
      const claimsWithNumericKeys = {
        0: "value",
        1: "another value",
        role: "admin",
      };
      expect(checkClaimsAreValid(claimsWithNumericKeys)).toBe(true);
    });

    it("should handle special characters in keys", () => {
      const claimsWithSpecialKeys = {
        "custom-role": "admin",
        custom_permission: "write",
        "custom.field": "value",
        "custom space": "value",
      };
      expect(checkClaimsAreValid(claimsWithSpecialKeys)).toBe(true);
    });
  });
});
