import { describe, it, expect } from "vitest";
import { getOauth2AccessTokenHandler } from "../src/google-auth/get-oauth-2-token.js";
import serviceAccountKey from "./service-account-key.json";
import { env } from "process";

const doNotRunIntegrationTests = env.RUN_INTEGRATION_TESTS !== "true";

describe.skipIf(doNotRunIntegrationTests)("CloudFireAuth Oauth2 Token Creation Integration Test", () => {
  it("should create a real CloudFireAuth instance and call listUsers", async () => {
    // Create a real CloudFireAuth instance
    const token = await getOauth2AccessTokenHandler(serviceAccountKey);

    expect(token).toBeDefined();
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(0);
    expect(token.split(".").length).toBe(3);

    // Make a real API call to lookup
    const apiResponse = await fetch("https://identitytoolkit.googleapis.com/v1/accounts:lookup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        localId: "1234567890",
      }),
    });

    expect(apiResponse.status).toBe(200);
  }, 5000); // 5 second timeout for real API call
});
