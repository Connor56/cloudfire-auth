import { execSync } from "node:child_process";

/**
 * Sets an environment variable to run integration tests, then runs the tests
 * using the vitest command.
 */
function testIntegration() {
  process.env.RUN_INTEGRATION_TESTS = "true";

  // Run the test command in the same process so it has access to the environment variable
  // stdio: "inherit" pipes output to the screen so you can see the command running
  execSync("npm run test", { stdio: "inherit" });
}

testIntegration();
